use diesel::{
    connection::SimpleConnection,
    prelude::*,
    sql_query,
    sql_types::{BigInt, Nullable, Text},
    SqliteConnection,
};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use time::{format_description::well_known::Rfc3339, Date, Month, OffsetDateTime};
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

use crate::models::{
    BaseCompetitorRow, CompetitionGroupPayload, CompetitionGroupRow, CompetitionGroupSelectionRow,
    ConfigRow, ConfigValueRow, CountRow, DesktopClaimReservedCodeRequest, DesktopCreateRegistrationRequest,
    DesktopCreateRegistrationResponse, DesktopClearRegistrationRequest, DesktopEventState,
    DesktopQueryCompetitorsRequest, DesktopQueryCompetitorsResponse, DesktopSetCompetitionGroupRequest,
    DesktopSyncStatus, EventRow, EventVersionRow, OutboxItem, OutboxRow, PaymentGroupMemberPayload,
    PaymentGroupMemberRow, PaymentGroupPayload, PaymentGroupRow, RecentRegistrationRow,
    RegistrationClearedPayload, RegistrationPayload, ReservedCodeClaimedPayload, ReservedCodePayload,
    ReservedCodeRow, SelectedRegistrationRow, SyncMetaRow,
    TableColumnRow, API_KEY_KEY, DEVICE_ID_KEY, PORTAL_BASE_URL_KEY, SELECTED_EVENT_KEY,
    SYNC_STATUS_EVENT,
};

const SCHEMA: &str = include_str!("../sql/schema.sql");

pub struct AppState {
    pub db_path: Mutex<Option<PathBuf>>,
    pub sync_status: Mutex<DesktopSyncStatus>,
    pub sync_lock: AsyncMutex<()>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db_path: Mutex::new(None),
            sync_status: Mutex::new(DesktopSyncStatus {
                status: "idle".to_string(),
                last_successful_sync_at: None,
                last_error: None,
                last_error_detail: None,
                pending_registrations: 0,
            }),
            sync_lock: AsyncMutex::new(()),
        }
    }
}

pub fn db_path(state: &State<AppState>) -> Result<PathBuf, String> {
    state
        .db_path
        .lock()
        .map_err(|_| "State lock failed".to_string())?
        .clone()
        .ok_or_else(|| "Database is not initialized".to_string())
}

pub fn conn(state: &State<AppState>) -> Result<SqliteConnection, String> {
    let db_file = db_path(state)?;
    SqliteConnection::establish(db_file.to_string_lossy().as_ref()).map_err(|error| error.to_string())
}

pub fn conn_from_app(app: &AppHandle) -> Result<SqliteConnection, String> {
    let state = app.state::<AppState>();
    conn(&state)
}

fn table_has_column(db: &mut SqliteConnection, table_name: &str, column_name: &str) -> Result<bool, String> {
    let sql = format!("PRAGMA table_info({table_name})");
    let rows = sql_query(sql)
        .load::<TableColumnRow>(db)
        .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().any(|row| row.name == column_name))
}

fn ensure_column(
    db: &mut SqliteConnection,
    table_name: &str,
    column_name: &str,
    definition: &str,
) -> Result<(), String> {
    if table_has_column(db, table_name, column_name)? {
        return Ok(());
    }

    sql_query(format!("ALTER TABLE {table_name} ADD COLUMN {definition}"))
        .execute(db)
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn init_schema(db: &mut SqliteConnection) -> Result<(), String> {
    db.batch_execute(SCHEMA).map_err(|error| error.to_string())?;
    ensure_column(db, "payment_groups", "color_hex", "color_hex TEXT")?;
    ensure_column(db, "payment_groups", "global_price_override_cents", "global_price_override_cents INTEGER")?;
    ensure_column(db, "payment_group_members", "price_override_cents", "price_override_cents INTEGER")?;
    ensure_column(db, "source_competitors", "gender", "gender TEXT")?;
    ensure_column(
        db,
        "registrations",
        "competition_group_name",
        "competition_group_name TEXT NOT NULL DEFAULT ''",
    )?;
    sql_query("UPDATE registrations SET competition_group_name = course_id WHERE competition_group_name = ''")
        .execute(db)
        .map_err(|error| error.to_string())?;
    ensure_column(db, "sync_meta", "last_sync_error_detail", "last_sync_error_detail TEXT")?;
    Ok(())
}

pub fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

pub fn normalize_portal_base_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

pub fn sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

pub fn sql_like_prefix(value: &str) -> String {
    sql_string(
        &value
            .to_lowercase()
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_"),
    )
}

pub fn tokenize_query(query: &str) -> Vec<String> {
    query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.trim().is_empty())
        .map(|token| token.trim().to_string())
        .collect()
}

pub fn upsert_device_config_value(
    db: &mut SqliteConnection,
    key: &str,
    value: &str,
) -> Result<(), diesel::result::Error> {
    sql_query(
        "INSERT INTO device_config(config_key, config_value) VALUES (?, ?) \
         ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value",
    )
    .bind::<Text, _>(key)
    .bind::<Text, _>(value)
    .execute(db)?;
    Ok(())
}

pub fn load_device_config_map(db: &mut SqliteConnection) -> Result<HashMap<String, String>, String> {
    let rows = sql_query("SELECT config_key, config_value FROM device_config")
        .load::<ConfigRow>(db)
        .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| (row.config_key, row.config_value))
        .collect())
}

pub fn pending_registrations_count(db: &mut SqliteConnection) -> Result<i64, String> {
    Ok(sql_query("SELECT COUNT(*) AS count FROM outbox WHERE status = 'pending'")
        .get_result::<CountRow>(db)
        .map_err(|error| error.to_string())?
        .count)
}

pub fn indexed_competitors_count(db: &mut SqliteConnection) -> Result<i64, String> {
    Ok(sql_query("SELECT COUNT(*) AS count FROM source_competitors")
        .get_result::<CountRow>(db)
        .map_err(|error| error.to_string())?
        .count)
}

pub fn all_filter_competitors_count(db: &mut SqliteConnection) -> Result<i64, String> {
    Ok(sql_query(
        "SELECT COUNT(*) AS count \
         FROM ( \
           SELECT competitor_id FROM payment_group_members \
           UNION \
           SELECT competitor_id FROM registrations \
         )",
    )
    .get_result::<CountRow>(db)
    .map_err(|error| error.to_string())?
    .count)
}

pub fn load_events(db: &mut SqliteConnection) -> Result<Vec<EventRow>, String> {
    sql_query(
        "SELECT event_id, name, start_date \
         FROM events \
         ORDER BY COALESCE(start_date, ''), name, event_id",
    )
    .load::<EventRow>(db)
    .map_err(|error| error.to_string())
}

pub fn load_payment_groups(db: &mut SqliteConnection) -> Result<Vec<PaymentGroupPayload>, String> {
    let groups = sql_query(
        "SELECT payment_group_id, name, color_hex, global_price_override_cents \
         FROM payment_groups \
         ORDER BY name, payment_group_id",
    )
    .load::<PaymentGroupRow>(db)
    .map_err(|error| error.to_string())?;
    let members = sql_query(
        "SELECT payment_group_id, competitor_id, price_override_cents \
         FROM payment_group_members \
         ORDER BY payment_group_id, competitor_id",
    )
    .load::<PaymentGroupMemberRow>(db)
    .map_err(|error| error.to_string())?;

    let mut members_by_group = HashMap::<String, Vec<PaymentGroupMemberPayload>>::new();
    let mut competitor_ids_by_group = HashMap::<String, Vec<String>>::new();
    for member in members {
        competitor_ids_by_group
            .entry(member.payment_group_id.clone())
            .or_default()
            .push(member.competitor_id.clone());
        members_by_group
            .entry(member.payment_group_id)
            .or_default()
            .push(PaymentGroupMemberPayload {
                competitor_id: member.competitor_id,
                price_override_cents: member.price_override_cents,
            });
    }

    Ok(groups
        .into_iter()
        .map(|group| PaymentGroupPayload {
            payment_group_id: group.payment_group_id.clone(),
            name: group.name,
            color_hex: group.color_hex,
            global_price_override_cents: group.global_price_override_cents,
            competitor_ids: competitor_ids_by_group
                .remove(&group.payment_group_id)
                .unwrap_or_default(),
            competitors: members_by_group.remove(&group.payment_group_id).unwrap_or_default(),
        })
        .collect())
}

pub fn load_competition_groups(db: &mut SqliteConnection) -> Result<Vec<CompetitionGroupPayload>, String> {
    sql_query(
        "SELECT name, gender, min_year, max_year, price_cents \
         FROM competition_groups \
         ORDER BY name",
    )
    .load::<CompetitionGroupRow>(db)
    .map_err(|error| error.to_string())
    .map(|rows| {
        rows.into_iter()
            .map(|row| CompetitionGroupPayload {
                name: row.name,
                gender: row.gender,
                min_year: row.min_year,
                max_year: row.max_year,
                price_cents: row.price_cents,
            })
            .collect()
    })
}

pub fn load_selected_event_id(db: &mut SqliteConnection) -> Result<String, String> {
    let rows = sql_query("SELECT config_value FROM device_config WHERE config_key = ?")
        .bind::<Text, _>(SELECTED_EVENT_KEY)
        .load::<ConfigValueRow>(db)
        .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().next().map(|row| row.config_value).unwrap_or_default())
}

pub fn ensure_selected_event_id(db: &mut SqliteConnection) -> Result<String, String> {
    let events = load_events(db)?;
    let selected = load_selected_event_id(db)?;
    if !selected.is_empty() && events.iter().any(|event| event.event_id == selected) {
        return Ok(selected);
    }

    let fallback = events
        .first()
        .map(|event| event.event_id.clone())
        .unwrap_or_default();
    upsert_device_config_value(db, SELECTED_EVENT_KEY, &fallback).map_err(|error| error.to_string())?;
    Ok(fallback)
}

fn parse_event_start_date(value: &str) -> Option<Date> {
    let mut segments = value.split('-');
    let year = segments.next()?.parse().ok()?;
    let month = Month::try_from(segments.next()?.parse::<u8>().ok()?).ok()?;
    let day = segments.next()?.parse().ok()?;
    if segments.next().is_some() {
        return None;
    }
    Date::from_calendar_date(year, month, day).ok()
}

fn find_closest_event_id(events: &[EventRow], today: Date) -> Option<String> {
    let today_julian_day = today.to_julian_day();
    events
        .iter()
        .filter_map(|event| {
            let start_date = parse_event_start_date(event.start_date.as_deref()?)?;
            let day_distance = (start_date.to_julian_day() - today_julian_day).abs();
            Some((day_distance, event.event_id.clone()))
        })
        .min_by_key(|(day_distance, _)| *day_distance)
        .map(|(_, event_id)| event_id)
}

fn select_startup_event_id_for_date(db: &mut SqliteConnection, today: Date) -> Result<String, String> {
    let events = load_events(db)?;
    let current_selected = load_selected_event_id(db)?;
    let selected = find_closest_event_id(&events, today)
        .or_else(|| {
            if !current_selected.is_empty() && events.iter().any(|event| event.event_id == current_selected) {
                Some(current_selected.clone())
            } else {
                None
            }
        })
        .or_else(|| events.first().map(|event| event.event_id.clone()))
        .unwrap_or_default();
    upsert_device_config_value(db, SELECTED_EVENT_KEY, &selected).map_err(|error| error.to_string())?;
    Ok(selected)
}

pub fn select_startup_event_id(db: &mut SqliteConnection) -> Result<String, String> {
    select_startup_event_id_for_date(db, OffsetDateTime::now_utc().date())
}

pub fn load_courses(db: &mut SqliteConnection, event_id: &str) -> Result<Vec<crate::models::CourseRow>, String> {
    if event_id.is_empty() {
        return Ok(Vec::new());
    }

    sql_query(
        "SELECT event_id, course_id, class_id, name, price_cents \
         FROM courses \
         WHERE event_id = ? \
         ORDER BY name, course_id",
    )
    .bind::<Text, _>(event_id)
    .load::<crate::models::CourseRow>(db)
    .map_err(|error| error.to_string())
}

fn load_latest_registrations(
    db: &mut SqliteConnection,
    event_id: &str,
) -> Result<HashMap<String, SelectedRegistrationRow>, String> {
    if event_id.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sql_query(
        "SELECT r.competitor_id, r.course_id, r.competition_group_name \
         FROM registrations r \
         INNER JOIN ( \
           SELECT competitor_id, MAX(local_seq) AS max_seq \
           FROM registrations \
           WHERE event_id = ? \
           GROUP BY competitor_id \
         ) latest \
           ON latest.competitor_id = r.competitor_id AND latest.max_seq = r.local_seq \
         WHERE r.event_id = ?",
    )
    .bind::<Text, _>(event_id)
    .bind::<Text, _>(event_id)
    .load::<SelectedRegistrationRow>(db)
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| (row.competitor_id.clone(), row))
        .collect())
}

pub fn load_selected_courses(
    db: &mut SqliteConnection,
    event_id: &str,
) -> Result<HashMap<String, String>, String> {
    Ok(load_latest_registrations(db, event_id)?
        .into_iter()
        .map(|(competitor_id, row)| (competitor_id, row.course_id))
        .collect())
}

fn load_competition_group_selections(
    db: &mut SqliteConnection,
    event_id: &str,
) -> Result<HashMap<String, String>, String> {
    if event_id.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sql_query(
        "SELECT competitor_id, competition_group_name \
         FROM competition_group_selections \
         WHERE event_id = ?",
    )
    .bind::<Text, _>(event_id)
    .load::<CompetitionGroupSelectionRow>(db)
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| (row.competitor_id, row.competition_group_name))
        .collect())
}

pub fn load_recent_registrations(
    db: &mut SqliteConnection,
    event_id: &str,
    limit: i64,
) -> Result<Vec<RecentRegistrationRow>, String> {
    if event_id.is_empty() {
        return Ok(Vec::new());
    }

    sql_query(
        "SELECT \
           r.registration_id, \
           r.competitor_id, \
           COALESCE(c.last_name || ' ' || c.first_name, c.eol_number, r.competitor_id) AS competitor_name, \
           r.course_id, \
           COALESCE(co.name, r.course_id) AS course_name, \
           r.competition_group_name, \
           r.price_cents, \
           r.created_at_device \
         FROM registrations r \
         LEFT JOIN source_competitors c ON c.competitor_id = r.competitor_id \
         LEFT JOIN courses co ON co.event_id = r.event_id AND co.course_id = r.course_id \
         WHERE r.event_id = ? \
         ORDER BY r.local_seq DESC, r.created_at_device DESC \
         LIMIT ?",
    )
    .bind::<Text, _>(event_id)
    .bind::<BigInt, _>(limit)
    .load::<RecentRegistrationRow>(db)
    .map_err(|error| error.to_string())
}

pub fn load_event_state(db: &mut SqliteConnection, selected_event_id: &str) -> Result<DesktopEventState, String> {
    Ok(DesktopEventState {
        selected_event_id: selected_event_id.to_string(),
        courses: load_courses(db, selected_event_id)?,
        selected_courses_by_competitor: load_selected_courses(db, selected_event_id)?,
        recent_registrations: load_recent_registrations(db, selected_event_id, 20)?,
    })
}

pub fn build_competitor_query(filter_id: &str, query: &str) -> String {
    let filter_sql = sql_string(filter_id);
    let terms = tokenize_query(query);
    let mut sql = String::from(
        "SELECT c.competitor_id, c.eol_number, c.first_name, c.last_name, c.gender, c.dob, c.club, c.si_card \
         FROM source_competitors c ",
    );

    if filter_id != "all" {
        sql.push_str(
            "INNER JOIN payment_group_members m \
             ON m.competitor_id = c.competitor_id ",
        );
    }

    let mut where_clauses = Vec::new();
    if filter_id == "all" {
        if terms.is_empty() {
            where_clauses.push(
                "(EXISTS (SELECT 1 FROM payment_group_members pgm WHERE pgm.competitor_id = c.competitor_id) \
                  OR EXISTS (SELECT 1 FROM registrations r WHERE r.competitor_id = c.competitor_id))"
                    .to_string(),
            );
        }
    } else {
        where_clauses.push(format!("m.payment_group_id = '{}'", filter_sql));
    }

    for term in terms {
        let escaped = sql_like_prefix(&term);
        where_clauses.push(format!(
            "(LOWER(c.eol_number) LIKE '{escaped}%' ESCAPE '\\' \
              OR LOWER(c.first_name) LIKE '{escaped}%' ESCAPE '\\' \
              OR LOWER(c.last_name) LIKE '{escaped}%' ESCAPE '\\' \
              OR LOWER(COALESCE(c.club, '')) LIKE '{escaped}%' ESCAPE '\\' \
              OR LOWER(COALESCE(c.si_card, '')) LIKE '{escaped}%' ESCAPE '\\')"
        ));
    }

    if !where_clauses.is_empty() {
        sql.push_str("WHERE ");
        sql.push_str(&where_clauses.join(" AND "));
        sql.push(' ');
    }

    sql.push_str("ORDER BY c.last_name, c.first_name, c.eol_number LIMIT 300");
    sql
}

fn parse_birth_year(dob: &Option<String>) -> Option<i64> {
    dob.as_ref()
        .and_then(|value| value.split('-').next())
        .and_then(|year| year.parse::<i64>().ok())
}

fn competition_group_matches(
    competitor: &BaseCompetitorRow,
    group: &CompetitionGroupPayload,
    enforce_gender: bool,
) -> bool {
    if enforce_gender {
        if let Some(required_gender) = &group.gender {
            if competitor.gender.as_ref() != Some(required_gender) {
                return false;
            }
        }
    }

    match parse_birth_year(&competitor.dob) {
        Some(year) => {
            if let Some(min_year) = group.min_year {
                if year < min_year {
                    return false;
                }
            }
            if let Some(max_year) = group.max_year {
                if year > max_year {
                    return false;
                }
            }
            true
        }
        None => group.min_year.is_none() && group.max_year.is_none(),
    }
}

fn eligible_competition_groups_for_competitor(
    competitor: &BaseCompetitorRow,
    competition_groups: &[CompetitionGroupPayload],
) -> Vec<CompetitionGroupPayload> {
    let mut eligible_groups = competition_groups
        .iter()
        .filter(|group| competition_group_matches(competitor, group, true))
        .cloned()
        .collect::<Vec<_>>();

    if eligible_groups.is_empty() && competitor.gender.is_none() {
        eligible_groups = competition_groups
            .iter()
            .filter(|group| competition_group_matches(competitor, group, false))
            .cloned()
            .collect::<Vec<_>>();
    }

    sort_competition_groups(&mut eligible_groups);
    eligible_groups
}

fn sort_competition_groups(groups: &mut [CompetitionGroupPayload]) {
    groups.sort_by(|left, right| match (left.max_year, right.max_year) {
        (Some(a), Some(b)) => a.cmp(&b).then_with(|| left.name.cmp(&right.name)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => left.name.cmp(&right.name),
    });
}

fn find_effective_price(
    competitor_id: &str,
    selected_group_name: &str,
    competition_groups: &[CompetitionGroupPayload],
    payment_groups: &[PaymentGroupPayload],
) -> Option<i64> {
    let base_price = competition_groups
        .iter()
        .find(|group| group.name == selected_group_name)
        .map(|group| group.price_cents)?;

    for group in payment_groups {
        if let Some(member) = group
            .competitors
            .iter()
            .find(|member| member.competitor_id == competitor_id && member.price_override_cents.is_some())
        {
            return member.price_override_cents;
        }
    }

    for group in payment_groups {
        if group.competitor_ids.iter().any(|id| id == competitor_id) && group.global_price_override_cents.is_some() {
            return group.global_price_override_cents;
        }
    }

    Some(base_price)
}

fn derive_selected_competition_group(
    eligible_groups: &[CompetitionGroupPayload],
    persisted_selection: Option<&String>,
    registration_selection: Option<&String>,
) -> Option<String> {
    if let Some(selection) = registration_selection {
        if eligible_groups.iter().any(|group| group.name == *selection) {
            return Some(selection.clone());
        }
    }

    if let Some(selection) = persisted_selection {
        if eligible_groups.iter().any(|group| group.name == *selection) {
            return Some(selection.clone());
        }
    }

    eligible_groups.first().map(|group| group.name.clone())
}

fn load_base_competitor(
    db: &mut SqliteConnection,
    competitor_id: &str,
) -> Result<Option<BaseCompetitorRow>, String> {
    let rows = sql_query(
        "SELECT competitor_id, eol_number, first_name, last_name, gender, dob, club, si_card \
         FROM source_competitors \
         WHERE competitor_id = ? \
         LIMIT 1",
    )
    .bind::<Text, _>(competitor_id)
    .load::<BaseCompetitorRow>(db)
    .map_err(|error| error.to_string())?;

    Ok(rows.into_iter().next())
}

pub fn query_competitors(
    db: &mut SqliteConnection,
    request: DesktopQueryCompetitorsRequest,
) -> Result<DesktopQueryCompetitorsResponse, String> {
    let selected_event_id = ensure_selected_event_id(db)?;
    let base_rows = sql_query(build_competitor_query(&request.filter_id, &request.query))
        .load::<BaseCompetitorRow>(db)
        .map_err(|error| error.to_string())?;
    let competition_groups = load_competition_groups(db)?;
    let payment_groups = load_payment_groups(db)?;
    let persisted_selections = load_competition_group_selections(db, &selected_event_id)?;
    let registrations = load_latest_registrations(db, &selected_event_id)?;

    let rows = base_rows
        .into_iter()
        .map(|base| {
            let eligible_groups = eligible_competition_groups_for_competitor(&base, &competition_groups);

            let registration = registrations.get(&base.competitor_id);
            let selected_competition_group_name = derive_selected_competition_group(
                &eligible_groups,
                persisted_selections.get(&base.competitor_id),
                registration.map(|item| &item.competition_group_name),
            );
            let price_cents = selected_competition_group_name
                .as_deref()
                .and_then(|name| find_effective_price(&base.competitor_id, name, &competition_groups, &payment_groups));

            crate::models::CompetitorRow {
                competitor_id: base.competitor_id,
                eol_number: base.eol_number,
                first_name: base.first_name,
                last_name: base.last_name,
                gender: base.gender,
                dob: base.dob,
                club: base.club,
                si_card: base.si_card,
                available_competition_groups: eligible_groups,
                selected_competition_group_name,
                price_cents,
            }
        })
        .collect::<Vec<_>>();

    Ok(DesktopQueryCompetitorsResponse {
        visible_count: rows.len() as i64,
        grouped_count: all_filter_competitors_count(db)?,
        indexed_count: indexed_competitors_count(db)?,
        rows,
    })
}

pub fn save_competition_group_selection(
    db: &mut SqliteConnection,
    request: DesktopSetCompetitionGroupRequest,
) -> Result<(), String> {
    sql_query(
        "INSERT INTO competition_group_selections(event_id, competitor_id, competition_group_name) VALUES (?, ?, ?) \
         ON CONFLICT(event_id, competitor_id) DO UPDATE SET competition_group_name = excluded.competition_group_name",
    )
    .bind::<Text, _>(&request.event_id)
    .bind::<Text, _>(&request.competitor_id)
    .bind::<Text, _>(&request.competition_group_name)
    .execute(db)
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn load_sync_status_from_db(db: &mut SqliteConnection) -> Result<DesktopSyncStatus, String> {
    let meta = sql_query(
        "SELECT last_competitor_version, last_successful_sync_at, last_sync_error, last_sync_error_detail, worker_status \
         FROM sync_meta WHERE singleton = 1",
    )
    .get_result::<SyncMetaRow>(db)
    .map_err(|error| error.to_string())?;

    Ok(DesktopSyncStatus {
        status: meta.worker_status,
        last_successful_sync_at: meta.last_successful_sync_at,
        last_error: meta.last_sync_error,
        last_error_detail: meta.last_sync_error_detail,
        pending_registrations: pending_registrations_count(db)?,
    })
}

pub fn emit_sync_status(app: &AppHandle, status: DesktopSyncStatus) -> Result<(), String> {
    {
        let state = app.state::<AppState>();
        let mut guard = state
            .sync_status
            .lock()
            .map_err(|_| "State lock failed".to_string())?;
        *guard = status.clone();
    }

    app.emit(SYNC_STATUS_EVENT, &status)
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn refresh_in_memory_sync_status(app: &AppHandle) -> Result<DesktopSyncStatus, String> {
    let mut db = conn_from_app(app)?;
    let status = load_sync_status_from_db(&mut db)?;
    let state = app.state::<AppState>();
    let mut guard = state
        .sync_status
        .lock()
        .map_err(|_| "State lock failed".to_string())?;
    *guard = status.clone();
    Ok(status)
}

pub fn build_device_cycle_request(
    db: &mut SqliteConnection,
) -> Result<crate::models::DeviceSyncCycleRequest, String> {
    let meta = sql_query(
        "SELECT last_competitor_version, last_successful_sync_at, last_sync_error, last_sync_error_detail, worker_status \
         FROM sync_meta WHERE singleton = 1",
    )
    .get_result::<SyncMetaRow>(db)
    .map_err(|error| error.to_string())?;
    let event_versions = sql_query("SELECT event_id, version FROM event_versions")
        .load::<EventVersionRow>(db)
        .map_err(|error| error.to_string())?;
    let outbox_rows = sql_query(
        "SELECT payload, created_at, status, item_type, local_seq \
         FROM outbox \
         WHERE status = 'pending' \
         ORDER BY local_seq ASC",
    )
    .load::<OutboxRow>(db)
    .map_err(|error| error.to_string())?;

    let pending_registrations = outbox_rows
        .into_iter()
        .map(|row| -> Result<OutboxItem, String> {
            Ok(OutboxItem {
                local_seq: row.local_seq,
                item_type: row.item_type,
                payload: serde_json::from_str(&row.payload).map_err(|error| error.to_string())?,
                created_at: row.created_at,
                status: row.status,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(crate::models::DeviceSyncCycleRequest {
        since_competitor_version: meta.last_competitor_version,
        event_versions: event_versions
            .into_iter()
            .map(|row| (row.event_id, row.version))
            .collect(),
        pending_registrations,
    })
}

pub fn load_available_reserved_codes(
    db: &mut SqliteConnection,
) -> Result<Vec<ReservedCodePayload>, String> {
    let rows = sql_query("SELECT code, is_reserved FROM reserved_codes WHERE is_reserved = 1 ORDER BY code")
        .load::<ReservedCodeRow>(db)
        .map_err(|error| error.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| ReservedCodePayload {
            code: row.code,
            is_reserved: row.is_reserved != 0,
        })
        .collect())
}

pub fn claim_reserved_code(
    db: &mut SqliteConnection,
    request: DesktopClaimReservedCodeRequest,
) -> Result<DesktopCreateRegistrationResponse, String> {
    let is_manual_eol = request.is_manual_eol.unwrap_or(false);

    if !is_manual_eol {
        // Verify reserved code exists and is still available
        let code_count = sql_query(
            "SELECT COUNT(*) AS count FROM reserved_codes WHERE code = ? AND is_reserved = 1",
        )
        .bind::<Text, _>(&request.code)
        .get_result::<CountRow>(db)
        .map_err(|error| error.to_string())?
        .count;
        if code_count == 0 {
            return Err("Reserved code not found or already claimed.".to_string());
        }
    }

    let competitor_id = Uuid::new_v4().to_string();
    let eol_number = request.code.clone();

    // Build a BaseCompetitorRow to compute eligible groups and price
    let base_competitor = BaseCompetitorRow {
        competitor_id: competitor_id.clone(),
        eol_number: eol_number.clone(),
        first_name: request.first_name.clone(),
        last_name: request.last_name.clone(),
        gender: Some(request.gender.clone()),
        dob: Some(request.dob.clone()),
        club: request.club.clone(),
        si_card: request.si_card.clone(),
    };

    let competition_group_name = request.competition_group_name.clone().unwrap_or_default();
    let competition_groups = load_competition_groups(db)?;
    let payment_groups = load_payment_groups(db)?;

    let price_cents = if competition_group_name.is_empty() {
        0i64
    } else {
        let eligible_groups = eligible_competition_groups_for_competitor(&base_competitor, &competition_groups);
        if !eligible_groups.iter().any(|group| group.name == competition_group_name) {
            return Err("Competition group is not valid for this competitor.".to_string());
        }
        find_effective_price(
            &competitor_id,
            &competition_group_name,
            &competition_groups,
            &payment_groups,
        )
        .ok_or_else(|| "Competition group price could not be resolved.".to_string())?
    };

    let config = load_device_config_map(db)?;
    let device_id = config
        .get(DEVICE_ID_KEY)
        .cloned()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            config
                .get(API_KEY_KEY)
                .cloned()
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| "desktop-local".to_string());
    let created_at = now_iso()?;
    let registration_id = Uuid::new_v4().to_string();

    db.transaction::<(), diesel::result::Error, _>(|connection| {
        // 1. Insert into source_competitors
        sql_query(
            "INSERT INTO source_competitors(competitor_id, eol_number, first_name, last_name, gender, dob, club, si_card) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(&competitor_id)
        .bind::<Text, _>(&eol_number)
        .bind::<Text, _>(&request.first_name)
        .bind::<Text, _>(&request.last_name)
        .bind::<diesel::sql_types::Nullable<Text>, _>(Some(request.gender.as_str()))
        .bind::<diesel::sql_types::Nullable<Text>, _>(Some(request.dob.as_str()))
        .bind::<diesel::sql_types::Nullable<Text>, _>(request.club.as_deref())
        .bind::<diesel::sql_types::Nullable<Text>, _>(request.si_card.as_deref())
        .execute(connection)?;

        // 2. Mark reserved code as claimed (only if using reserved code, not manual EOL)
        if !is_manual_eol {
            sql_query("UPDATE reserved_codes SET is_reserved = 0 WHERE code = ?")
                .bind::<Text, _>(&request.code)
                .execute(connection)?;
        }

        // 3. Get next local_seq
        let claim_seq = sql_query(
            "SELECT COALESCE(MAX(local_seq), 0) + 1 AS count \
             FROM ( \
               SELECT local_seq FROM outbox \
               UNION ALL \
               SELECT local_seq FROM registrations \
             )",
        )
        .get_result::<CountRow>(connection)?
        .count;

        // 4. Insert outbox item for reserved_code_claimed
        let claim_payload = serde_json::to_string(&ReservedCodeClaimedPayload {
            code: request.code.clone(),
            competitor_id: competitor_id.clone(),
            eol_number: eol_number.clone(),
            first_name: request.first_name.clone(),
            last_name: request.last_name.clone(),
            gender: Some(request.gender.clone()),
            dob: Some(request.dob.clone()),
            club: request.club.clone(),
            si_card: request.si_card.clone(),
            is_manual_eol: Some(is_manual_eol),
        })
        .map_err(|error| diesel::result::Error::SerializationError(Box::new(error)))?;

        sql_query(
            "INSERT INTO outbox(local_seq, item_type, payload, created_at, status) VALUES (?, ?, ?, ?, 'pending')",
        )
        .bind::<BigInt, _>(claim_seq)
        .bind::<Text, _>("reserved_code_claimed")
        .bind::<Text, _>(claim_payload)
        .bind::<Text, _>(&created_at)
        .execute(connection)?;

        // 5. Get next local_seq for registration
        let reg_seq = sql_query(
            "SELECT COALESCE(MAX(local_seq), 0) + 1 AS count \
             FROM ( \
               SELECT local_seq FROM outbox \
               UNION ALL \
               SELECT local_seq FROM registrations \
             )",
        )
        .get_result::<CountRow>(connection)?
        .count;

        // 6. Save competition group selection (only if a group was chosen)
        if !competition_group_name.is_empty() {
            sql_query(
                "INSERT INTO competition_group_selections(event_id, competitor_id, competition_group_name) VALUES (?, ?, ?) \
                 ON CONFLICT(event_id, competitor_id) DO UPDATE SET competition_group_name = excluded.competition_group_name",
            )
            .bind::<Text, _>(&request.event_id)
            .bind::<Text, _>(&competitor_id)
            .bind::<Text, _>(&competition_group_name)
            .execute(connection)?;
        }

        // 7. Insert registration
        sql_query(
            "INSERT INTO registrations(registration_id, device_id, event_id, competitor_id, course_id, competition_group_name, price_cents, created_at_device, local_seq) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(&registration_id)
        .bind::<Text, _>(&device_id)
        .bind::<Text, _>(&request.event_id)
        .bind::<Text, _>(&competitor_id)
        .bind::<Text, _>(&request.course_id)
        .bind::<Text, _>(&competition_group_name)
        .bind::<BigInt, _>(price_cents)
        .bind::<Text, _>(&created_at)
        .bind::<BigInt, _>(reg_seq)
        .execute(connection)?;

        // 8. Insert registration outbox item
        let reg_payload = serde_json::to_string(&RegistrationPayload {
            registration_id: registration_id.clone(),
            device_id: device_id.clone(),
            event_id: request.event_id.clone(),
            competitor_id: competitor_id.clone(),
            course_id: request.course_id.clone(),
            competition_group_name: competition_group_name.clone(),
            price_cents,
            created_at_device: created_at.clone(),
            local_seq: reg_seq,
        })
        .map_err(|error| diesel::result::Error::SerializationError(Box::new(error)))?;

        sql_query(
            "INSERT INTO outbox(local_seq, item_type, payload, created_at, status) VALUES (?, ?, ?, ?, 'pending')",
        )
        .bind::<BigInt, _>(reg_seq)
        .bind::<Text, _>("registration_created")
        .bind::<Text, _>(reg_payload)
        .bind::<Text, _>(&created_at)
        .execute(connection)?;

        Ok(())
    })
    .map_err(|error| error.to_string())?;

    Ok(DesktopCreateRegistrationResponse {
        selected_event_id: request.event_id.clone(),
        courses: load_courses(db, &request.event_id)?,
        selected_courses_by_competitor: load_selected_courses(db, &request.event_id)?,
        recent_registrations: load_recent_registrations(db, &request.event_id, 20)?,
        push_result: None,
    })
}

pub fn create_registration(
    db: &mut SqliteConnection,
    request: DesktopCreateRegistrationRequest,
) -> Result<DesktopCreateRegistrationResponse, String> {
    let competitor = load_base_competitor(db, &request.competitor_id)?
        .ok_or_else(|| "Competitor not found.".to_string())?;
    let competition_groups = load_competition_groups(db)?;
    let eligible_groups = eligible_competition_groups_for_competitor(&competitor, &competition_groups);
    if !eligible_groups
        .iter()
        .any(|group| group.name == request.competition_group_name)
    {
        return Err("Competition group is not valid for this competitor.".to_string());
    }

    let payment_groups = load_payment_groups(db)?;
    let price_cents = find_effective_price(
        &request.competitor_id,
        &request.competition_group_name,
        &competition_groups,
        &payment_groups,
    )
    .ok_or_else(|| "Competition group price could not be resolved.".to_string())?;

    let config = load_device_config_map(db)?;
    let device_id = config
        .get(DEVICE_ID_KEY)
        .cloned()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            config
                .get(API_KEY_KEY)
                .cloned()
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| "desktop-local".to_string());
    let created_at = now_iso()?;
    let registration_id = Uuid::new_v4().to_string();

    db.transaction::<(), diesel::result::Error, _>(|connection| {
        let next_local_seq = sql_query(
            "SELECT COALESCE(MAX(local_seq), 0) + 1 AS count \
             FROM ( \
               SELECT local_seq FROM outbox \
               UNION ALL \
               SELECT local_seq FROM registrations \
             )",
        )
        .get_result::<CountRow>(connection)?
        .count;

        sql_query(
            "INSERT INTO competition_group_selections(event_id, competitor_id, competition_group_name) VALUES (?, ?, ?) \
             ON CONFLICT(event_id, competitor_id) DO UPDATE SET competition_group_name = excluded.competition_group_name",
        )
        .bind::<Text, _>(&request.event_id)
        .bind::<Text, _>(&request.competitor_id)
        .bind::<Text, _>(&request.competition_group_name)
        .execute(connection)?;

        sql_query(
            "INSERT INTO registrations(registration_id, device_id, event_id, competitor_id, course_id, competition_group_name, price_cents, created_at_device, local_seq) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(&registration_id)
        .bind::<Text, _>(&device_id)
        .bind::<Text, _>(&request.event_id)
        .bind::<Text, _>(&request.competitor_id)
        .bind::<Text, _>(&request.course_id)
        .bind::<Text, _>(&request.competition_group_name)
        .bind::<BigInt, _>(price_cents)
        .bind::<Text, _>(&created_at)
        .bind::<BigInt, _>(next_local_seq)
        .execute(connection)?;

        let payload = serde_json::to_string(&RegistrationPayload {
            registration_id: registration_id.clone(),
            device_id: device_id.clone(),
            event_id: request.event_id.clone(),
            competitor_id: request.competitor_id.clone(),
            course_id: request.course_id.clone(),
            competition_group_name: request.competition_group_name.clone(),
            price_cents,
            created_at_device: created_at.clone(),
            local_seq: next_local_seq,
        })
        .map_err(|error| diesel::result::Error::SerializationError(Box::new(error)))?;

        sql_query(
            "INSERT INTO outbox(local_seq, item_type, payload, created_at, status) VALUES (?, ?, ?, ?, 'pending')",
        )
        .bind::<BigInt, _>(next_local_seq)
        .bind::<Text, _>("registration_created")
        .bind::<Text, _>(payload)
        .bind::<Text, _>(&created_at)
        .execute(connection)?;

        Ok(())
    })
    .map_err(|error| error.to_string())?;

    Ok(DesktopCreateRegistrationResponse {
        selected_event_id: request.event_id.clone(),
        courses: load_courses(db, &request.event_id)?,
        selected_courses_by_competitor: load_selected_courses(db, &request.event_id)?,
        recent_registrations: load_recent_registrations(db, &request.event_id, 20)?,
        push_result: None,
    })
}

pub fn clear_registration(
    db: &mut SqliteConnection,
    request: DesktopClearRegistrationRequest,
) -> Result<DesktopEventState, String> {
    let existing_count = sql_query(
        "SELECT COUNT(*) AS count \
         FROM registrations \
         WHERE event_id = ? AND competitor_id = ?",
    )
    .bind::<Text, _>(&request.event_id)
    .bind::<Text, _>(&request.competitor_id)
    .get_result::<CountRow>(db)
    .map_err(|error| error.to_string())?
    .count;
    if existing_count == 0 {
        return Err("No registration found to clear.".to_string());
    }

    let has_server_visible_registration = sql_query(
        "SELECT COUNT(*) AS count \
         FROM registrations r \
         LEFT JOIN outbox o \
           ON o.local_seq = r.local_seq \
          AND o.item_type = 'registration_created' \
          AND o.status = 'pending' \
         WHERE r.event_id = ? AND r.competitor_id = ? AND o.local_seq IS NULL",
    )
    .bind::<Text, _>(&request.event_id)
    .bind::<Text, _>(&request.competitor_id)
    .get_result::<CountRow>(db)
    .map_err(|error| error.to_string())?
    .count
        > 0;

    let created_at = now_iso()?;

    db.transaction::<(), diesel::result::Error, _>(|connection| {
        if has_server_visible_registration {
            let next_local_seq = sql_query(
                "SELECT COALESCE(MAX(local_seq), 0) + 1 AS count \
                 FROM ( \
                   SELECT local_seq FROM outbox \
                   UNION ALL \
                   SELECT local_seq FROM registrations \
                 )",
            )
            .get_result::<CountRow>(connection)?
            .count;

            let payload = serde_json::to_string(&RegistrationClearedPayload {
                event_id: request.event_id.clone(),
                competitor_id: request.competitor_id.clone(),
                created_at_device: created_at.clone(),
                local_seq: next_local_seq,
            })
            .map_err(|error| diesel::result::Error::SerializationError(Box::new(error)))?;

            sql_query(
                "INSERT INTO outbox(local_seq, item_type, payload, created_at, status) VALUES (?, ?, ?, ?, 'pending')",
            )
            .bind::<BigInt, _>(next_local_seq)
            .bind::<Text, _>("registration_cleared")
            .bind::<Text, _>(payload)
            .bind::<Text, _>(&created_at)
            .execute(connection)?;
        }

        sql_query(
            "DELETE FROM outbox \
             WHERE local_seq IN ( \
               SELECT local_seq FROM registrations WHERE event_id = ? AND competitor_id = ? \
             )",
        )
        .bind::<Text, _>(&request.event_id)
        .bind::<Text, _>(&request.competitor_id)
        .execute(connection)?;

        sql_query("DELETE FROM registrations WHERE event_id = ? AND competitor_id = ?")
            .bind::<Text, _>(&request.event_id)
            .bind::<Text, _>(&request.competitor_id)
            .execute(connection)?;

        Ok(())
    })
    .map_err(|error| error.to_string())?;

    load_event_state(db, &request.event_id)
}

pub fn update_sync_error(
    db: &mut SqliteConnection,
    message: &str,
    detail: Option<&str>,
) -> Result<DesktopSyncStatus, String> {
    sql_query(
        "UPDATE sync_meta SET last_sync_error = ?, last_sync_error_detail = ?, worker_status = 'offline' WHERE singleton = 1",
    )
    .bind::<Text, _>(message)
    .bind::<Nullable<Text>, _>(detail)
    .execute(db)
    .map_err(|error| error.to_string())?;
    load_sync_status_from_db(db)
}

pub fn device_config_for_sync(
    db: &mut SqliteConnection,
) -> Result<(String, String), String> {
    let config = load_device_config_map(db)?;
    let portal_base_url = normalize_portal_base_url(config.get(PORTAL_BASE_URL_KEY).map(String::as_str).unwrap_or(""));
    let api_key = config.get(API_KEY_KEY).cloned().unwrap_or_default();
    Ok((portal_base_url, api_key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};

    fn temp_db_path(label: &str) -> PathBuf {
        let file = std::env::temp_dir().join(format!("or-start-list-{label}-{}.sqlite", Uuid::new_v4()));
        if file.exists() {
            let _ = fs::remove_file(&file);
        }
        file
    }

    fn open_temp_db(label: &str) -> SqliteConnection {
        let path = temp_db_path(label);
        let mut connection =
            SqliteConnection::establish(path.to_string_lossy().as_ref()).expect("open sqlite");
        init_schema(&mut connection).expect("init schema");
        connection
    }

    #[test]
    fn competition_group_sorting_prefers_lowest_max_year() {
        let mut groups = vec![
            CompetitionGroupPayload {
                name: "Open".to_string(),
                gender: None,
                min_year: None,
                max_year: None,
                price_cents: 1000,
            },
            CompetitionGroupPayload {
                name: "M21".to_string(),
                gender: Some("male".to_string()),
                min_year: Some(2000),
                max_year: Some(2005),
                price_cents: 1000,
            },
            CompetitionGroupPayload {
                name: "M20".to_string(),
                gender: Some("male".to_string()),
                min_year: Some(2000),
                max_year: Some(2004),
                price_cents: 1000,
            },
        ];

        sort_competition_groups(&mut groups);
        assert_eq!(groups[0].name, "M20");
        assert_eq!(groups[1].name, "M21");
        assert_eq!(groups[2].name, "Open");
    }

    #[test]
    fn create_registration_uses_personal_override_price() {
        let mut db = open_temp_db("create-registration");
        sql_query("INSERT INTO events(event_id, name, start_date) VALUES ('event-1', 'Event', '2026-03-08')")
            .execute(&mut db)
            .expect("insert event");
        sql_query("INSERT INTO courses(event_id, course_id, class_id, name, price_cents) VALUES ('event-1', 'course-1', 'class-1', 'Open', 500)")
            .execute(&mut db)
            .expect("insert course");
        sql_query("INSERT INTO source_competitors(competitor_id, eol_number, first_name, last_name, gender, dob, club, si_card) VALUES ('comp-1', '100', 'Alice', 'Anders', 'female', '2004-01-01', NULL, NULL)")
            .execute(&mut db)
            .expect("insert competitor");
        sql_query("INSERT INTO competition_groups(name, gender, min_year, max_year, price_cents) VALUES ('N21', 'female', 2000, 2005, 1200)")
            .execute(&mut db)
            .expect("insert comp group");
        sql_query("INSERT INTO payment_groups(payment_group_id, name, global_price_override_cents) VALUES ('pg-1', 'Group', 900)")
            .execute(&mut db)
            .expect("insert payment group");
        sql_query("INSERT INTO payment_group_members(payment_group_id, competitor_id, price_override_cents) VALUES ('pg-1', 'comp-1', 700)")
            .execute(&mut db)
            .expect("insert payment member");

        let response = create_registration(
            &mut db,
            DesktopCreateRegistrationRequest {
                event_id: "event-1".to_string(),
                competitor_id: "comp-1".to_string(),
                course_id: "course-1".to_string(),
                competition_group_name: "N21".to_string(),
            },
        )
        .expect("create registration");

        assert_eq!(response.selected_courses_by_competitor.get("comp-1"), Some(&"course-1".to_string()));
        let rows = load_recent_registrations(&mut db, "event-1", 10).expect("recent");
        assert_eq!(rows[0].competition_group_name, "N21");
        assert_eq!(rows[0].price_cents, 700);
    }

    #[test]
    fn unknown_gender_falls_back_to_year_only_matching() {
        let competitor = BaseCompetitorRow {
            competitor_id: "comp-1".to_string(),
            eol_number: "100".to_string(),
            first_name: "Alex".to_string(),
            last_name: "Example".to_string(),
            gender: None,
            dob: Some("2004-01-01".to_string()),
            club: None,
            si_card: None,
        };
        let groups = vec![
            CompetitionGroupPayload {
                name: "M21".to_string(),
                gender: Some("male".to_string()),
                min_year: Some(2000),
                max_year: Some(2005),
                price_cents: 800,
            },
            CompetitionGroupPayload {
                name: "N21".to_string(),
                gender: Some("female".to_string()),
                min_year: Some(2000),
                max_year: Some(2005),
                price_cents: 800,
            },
        ];

        let eligible = eligible_competition_groups_for_competitor(&competitor, &groups);

        assert_eq!(eligible.len(), 2);
        assert_eq!(eligible[0].name, "M21");
        assert_eq!(eligible[1].name, "N21");
    }

    #[test]
    fn select_startup_event_id_prefers_event_closest_to_today() {
        let mut db = open_temp_db("startup-event-selection");
        sql_query(
            "INSERT INTO events(event_id, name, start_date) VALUES \
             ('event-past', 'Past Event', '2026-03-20'), \
             ('event-closest', 'Closest Event', '2026-03-23'), \
             ('event-future', 'Future Event', '2026-03-30')",
        )
        .execute(&mut db)
        .expect("insert events");
        upsert_device_config_value(&mut db, SELECTED_EVENT_KEY, "event-future").expect("seed selected event");

        let selected_event_id = select_startup_event_id_for_date(
            &mut db,
            Date::from_calendar_date(2026, Month::March, 22).expect("valid date"),
        )
        .expect("select startup event");

        assert_eq!(selected_event_id, "event-closest");
        assert_eq!(
            load_selected_event_id(&mut db).expect("load selected event"),
            "event-closest"
        );
    }
}
