use diesel::{prelude::*, sql_query, sql_types::{BigInt, Integer, Nullable, Text}};
use log::{error, info, warn};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde_json::json;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio::time::sleep;

use crate::database::{
    build_device_cycle_request, conn_from_app, device_config_for_sync, emit_sync_status,
    ensure_selected_event_id, load_sync_status_from_db, refresh_in_memory_sync_status,
    update_sync_error,
};
use crate::models::{BaseCompetitorRow, DeviceSyncCycleResponse, PullPayload};

fn build_headers(api_key: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-device-key",
        HeaderValue::from_str(api_key).map_err(|error| error.to_string())?,
    );
    Ok(headers)
}

async fn report_device_heartbeat(
    client: &reqwest::Client,
    portal_base_url: &str,
    api_key: &str,
    event_id: &str,
    status: &str,
    last_error: Option<&str>,
) {
    let heartbeat_url = format!("{portal_base_url}/api/sync/heartbeat");
    let metadata = json!({
        "source": "device-cycle",
        "lastError": last_error,
    });

    let response = client
        .post(&heartbeat_url)
        .headers(match build_headers(api_key) {
            Ok(headers) => headers,
            Err(error) => {
                warn!("Failed to build heartbeat headers: {}", error);
                return;
            }
        })
        .json(&json!({
            "eventId": if event_id.is_empty() { "global" } else { event_id },
            "status": status,
            "appVersion": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
            "metadata": metadata,
        }))
        .send()
        .await;

    match response {
        Ok(response) if response.status().is_success() => {}
        Ok(response) => {
            warn!("Heartbeat update failed with status {}", response.status());
        }
        Err(error) => {
            warn!("Heartbeat update request failed: {}", error);
        }
    }
}

fn upsert_competitor(connection: &mut diesel::SqliteConnection, competitor: &BaseCompetitorRow) -> Result<(), diesel::result::Error> {
    sql_query(
        "INSERT INTO source_competitors(competitor_id, eol_number, first_name, last_name, gender, dob, club, si_card) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(competitor_id) DO UPDATE SET \
           eol_number = excluded.eol_number, \
           first_name = excluded.first_name, \
           last_name = excluded.last_name, \
           gender = excluded.gender, \
           dob = excluded.dob, \
           club = excluded.club, \
           si_card = excluded.si_card",
    )
    .bind::<Text, _>(&competitor.competitor_id)
    .bind::<Text, _>(&competitor.eol_number)
    .bind::<Text, _>(&competitor.first_name)
    .bind::<Text, _>(&competitor.last_name)
    .bind::<Nullable<Text>, _>(competitor.gender.as_deref())
    .bind::<Nullable<Text>, _>(competitor.dob.as_deref())
    .bind::<Nullable<Text>, _>(competitor.club.as_deref())
    .bind::<Nullable<Text>, _>(competitor.si_card.as_deref())
    .execute(connection)?;
    Ok(())
}

fn apply_event_snapshot(
    connection: &mut diesel::SqliteConnection,
    snapshot: &PullPayload,
) -> Result<(), diesel::result::Error> {
    let event_id = snapshot
        .data
        .event
        .as_ref()
        .map(|event| event.event_id.as_str())
        .or_else(|| snapshot.data.classes.first().map(|class| class.event_id.as_str()))
        .or_else(|| snapshot.data.courses.first().map(|course| course.event_id.as_str()))
        .or_else(|| snapshot.data.filters.first().map(|filter| filter.event_id.as_str()))
        .or_else(|| snapshot.data.pricing.first().map(|pricing| pricing.event_id.as_str()))
        .unwrap_or("");

    if event_id.is_empty() {
        return Ok(());
    }

    sql_query("DELETE FROM classes WHERE event_id = ?")
        .bind::<Text, _>(event_id)
        .execute(connection)?;
    sql_query("DELETE FROM courses WHERE event_id = ?")
        .bind::<Text, _>(event_id)
        .execute(connection)?;
    sql_query("DELETE FROM quick_filters WHERE event_id = ?")
        .bind::<Text, _>(event_id)
        .execute(connection)?;
    sql_query("DELETE FROM pricing_rules WHERE event_id = ?")
        .bind::<Text, _>(event_id)
        .execute(connection)?;

    if let Some(event) = &snapshot.data.event {
        sql_query(
            "INSERT INTO events(event_id, name, start_date) VALUES (?, ?, ?) \
             ON CONFLICT(event_id) DO UPDATE SET \
               name = excluded.name, \
               start_date = excluded.start_date",
        )
        .bind::<Text, _>(&event.event_id)
        .bind::<Text, _>(&event.name)
        .bind::<Nullable<Text>, _>(event.start_date.as_deref())
        .execute(connection)?;
    }

    for class in &snapshot.data.classes {
        sql_query("INSERT INTO classes(event_id, class_id, name, short_name) VALUES (?, ?, ?, ?)")
            .bind::<Text, _>(&class.event_id)
            .bind::<Text, _>(&class.class_id)
            .bind::<Text, _>(&class.name)
            .bind::<Text, _>(&class.short_name)
            .execute(connection)?;
    }

    for course in &snapshot.data.courses {
        sql_query("INSERT INTO courses(event_id, course_id, class_id, name, price_cents) VALUES (?, ?, ?, ?, ?)")
            .bind::<Text, _>(&course.event_id)
            .bind::<Text, _>(&course.course_id)
            .bind::<Text, _>(&course.class_id)
            .bind::<Text, _>(&course.name)
            .bind::<BigInt, _>(course.price_cents)
            .execute(connection)?;
    }

    for filter in &snapshot.data.filters {
        sql_query("INSERT INTO quick_filters(event_id, filter_id, name, query_definition) VALUES (?, ?, ?, ?)")
            .bind::<Text, _>(&filter.event_id)
            .bind::<Text, _>(&filter.filter_id)
            .bind::<Text, _>(&filter.name)
            .bind::<Text, _>(&filter.query_definition)
            .execute(connection)?;
    }

    for pricing in &snapshot.data.pricing {
        sql_query("INSERT INTO pricing_rules(event_id, pricing_rule_id, rule_name, payload) VALUES (?, ?, ?, ?)")
            .bind::<Text, _>(&pricing.event_id)
            .bind::<Text, _>(&pricing.pricing_rule_id)
            .bind::<Text, _>(&pricing.rule_name)
            .bind::<Text, _>(pricing.payload.to_string())
            .execute(connection)?;
    }

    for registration in &snapshot.data.registrations {
        sql_query(
            "INSERT INTO registrations(registration_id, device_id, event_id, competitor_id, course_id, competition_group_name, price_cents, created_at_device, local_seq) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
             ON CONFLICT(registration_id) DO UPDATE SET \
               device_id = excluded.device_id, \
               event_id = excluded.event_id, \
               competitor_id = excluded.competitor_id, \
               course_id = excluded.course_id, \
               competition_group_name = excluded.competition_group_name, \
               price_cents = excluded.price_cents, \
               created_at_device = excluded.created_at_device, \
               local_seq = excluded.local_seq",
        )
        .bind::<Text, _>(&registration.registration_id)
        .bind::<Text, _>(&registration.device_id)
        .bind::<Text, _>(&registration.event_id)
        .bind::<Text, _>(&registration.competitor_id)
        .bind::<Text, _>(&registration.course_id)
        .bind::<Text, _>(&registration.competition_group_name)
        .bind::<BigInt, _>(registration.price_cents)
        .bind::<Text, _>(&registration.created_at_device)
        .bind::<BigInt, _>(registration.local_seq)
        .execute(connection)?;
    }

    sql_query(
        "INSERT INTO event_versions(event_id, version) VALUES (?, ?) \
         ON CONFLICT(event_id) DO UPDATE SET version = excluded.version",
    )
    .bind::<Text, _>(event_id)
    .bind::<BigInt, _>(snapshot.version)
    .execute(connection)?;

    Ok(())
}

pub fn apply_cycle_response(
    db: &mut diesel::SqliteConnection,
    payload: &DeviceSyncCycleResponse,
) -> Result<(), String> {
    let now = crate::database::now_iso()?;
    db.transaction::<(), diesel::result::Error, _>(|connection| {
        sql_query("DELETE FROM events").execute(connection)?;
        for event in &payload.events {
            sql_query("INSERT INTO events(event_id, name, start_date) VALUES (?, ?, ?)")
                .bind::<Text, _>(&event.event_id)
                .bind::<Text, _>(&event.name)
                .bind::<Nullable<Text>, _>(event.start_date.as_deref())
                .execute(connection)?;
        }

        sql_query("DELETE FROM payment_group_members").execute(connection)?;
        sql_query("DELETE FROM payment_groups").execute(connection)?;
        for group in &payload.payment_groups {
            sql_query("INSERT INTO payment_groups(payment_group_id, name, color_hex, global_price_override, sort_order) VALUES (?, ?, ?, ?, ?)")
                .bind::<Text, _>(&group.payment_group_id)
                .bind::<Text, _>(&group.name)
                .bind::<Nullable<Text>, _>(group.color_hex.as_deref())
                .bind::<Nullable<BigInt>, _>(group.global_price_override)
                .bind::<Integer, _>(group.sort_order)
                .execute(connection)?;
            for competitor in &group.competitors {
                sql_query("INSERT INTO payment_group_members(payment_group_id, competitor_id, price_override_cents, compensated_events, events_attended) VALUES (?, ?, ?, ?, ?)")
                    .bind::<Text, _>(&group.payment_group_id)
                    .bind::<Text, _>(&competitor.competitor_id)
                    .bind::<Nullable<BigInt>, _>(competitor.price_override_cents)
                    .bind::<Nullable<BigInt>, _>(competitor.compensated_events)
                    .bind::<BigInt, _>(competitor.events_attended.unwrap_or(0))
                    .execute(connection)?;
            }
        }

        sql_query("DELETE FROM map_preferences").execute(connection)?;
        for pref in &payload.map_preferences {
            sql_query("INSERT INTO map_preferences(competitor_id, course_name, waterproof_map) VALUES (?, ?, ?)")
                .bind::<Text, _>(&pref.competitor_id)
                .bind::<Text, _>(&pref.course_name)
                .bind::<Integer, _>(if pref.waterproof_map { 1i32 } else { 0i32 })
                .execute(connection)?;
        }

        sql_query("DELETE FROM competition_groups").execute(connection)?;
        for group in &payload.competition_groups {
            sql_query(
                "INSERT INTO competition_groups(name, gender, min_year, max_year, price_cents) VALUES (?, ?, ?, ?, ?)",
            )
            .bind::<Text, _>(&group.name)
            .bind::<Nullable<Text>, _>(group.gender.as_deref())
            .bind::<Nullable<BigInt>, _>(group.min_year)
            .bind::<Nullable<BigInt>, _>(group.max_year)
            .bind::<BigInt, _>(group.price_cents)
            .execute(connection)?;
        }

        // Apply reserved codes snapshot, preserving locally-claimed codes still pending in outbox
        sql_query(
            "DELETE FROM reserved_codes WHERE code NOT IN ( \
               SELECT json_extract(payload, '$.code') FROM outbox \
               WHERE item_type = 'reserved_code_claimed' AND status = 'pending' \
             )",
        )
        .execute(connection)?;
        for code in &payload.reserved_codes {
            sql_query("INSERT OR IGNORE INTO reserved_codes(code, is_reserved) VALUES (?, ?)")
                .bind::<Text, _>(&code.code)
                .bind::<BigInt, _>(if code.is_reserved { 1i64 } else { 0i64 })
                .execute(connection)?;
        }

        sql_query("DELETE FROM info_pages").execute(connection)?;
        for page in &payload.info_pages {
            sql_query(
                "INSERT INTO info_pages(id, title, content, updated_at) VALUES (?, ?, ?, ?)",
            )
            .bind::<Text, _>(&page.id)
            .bind::<Text, _>(&page.title)
            .bind::<Text, _>(&page.content)
            .bind::<Text, _>(&page.updated_at)
            .execute(connection)?;
        }

        for change in &payload.competitor_delta.changes {
            if change.change_type == "delete" {
                sql_query("DELETE FROM source_competitors WHERE competitor_id = ?")
                    .bind::<Text, _>(&change.competitor_id)
                    .execute(connection)?;
            } else if let Some(competitor) = &change.competitor {
                upsert_competitor(connection, competitor)?;
            }
        }

        for snapshot in &payload.event_snapshots {
            apply_event_snapshot(connection, snapshot)?;
        }

        sql_query("UPDATE outbox SET status = 'synced' WHERE local_seq <= ? AND status = 'pending'")
            .bind::<BigInt, _>(payload.ack_seq_inclusive)
            .execute(connection)?;
        for rejected in &payload.rejected {
            sql_query("UPDATE outbox SET status = 'failed' WHERE local_seq = ?")
                .bind::<BigInt, _>(rejected.local_seq)
                .execute(connection)?;
        }

        sql_query("DELETE FROM event_versions WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM classes WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM courses WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM quick_filters WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM pricing_rules WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM registrations WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;
        sql_query("DELETE FROM competition_group_selections WHERE event_id NOT IN (SELECT event_id FROM events)")
            .execute(connection)?;

        sql_query(
            "UPDATE sync_meta SET \
               last_competitor_version = ?, \
               last_successful_sync_at = ?, \
               last_sync_error = NULL, \
               worker_status = 'online' \
             WHERE singleton = 1",
        )
        .bind::<BigInt, _>(payload.competitor_delta.current_version)
        .bind::<Text, _>(&now)
        .execute(connection)?;
        Ok(())
    })
    .map_err(|error| error.to_string())
}

pub async fn run_sync_cycle(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<crate::database::AppState>();
    let _sync_guard = state.sync_lock.lock().await;
    info!("Starting sync cycle");

    let current_status = refresh_in_memory_sync_status(app)?;
    emit_sync_status(
        app,
        crate::models::DesktopSyncStatus {
            status: "syncing".to_string(),
            ..current_status
        },
    )?;

    let mut db = conn_from_app(app)?;
    let heartbeat_event_id = ensure_selected_event_id(&mut db).unwrap_or_default();
    let (portal_base_url, api_key) = device_config_for_sync(&mut db)?;
    if portal_base_url.is_empty() || api_key.is_empty() {
        let status = update_sync_error(
            &mut db,
            "Missing portalBaseUrl or apiKey in local device config.",
            None,
        )?;
        emit_sync_status(app, status)?;
        warn!("Skipping sync cycle because device config is incomplete");
        return Err("Missing local sync config.".to_string());
    }

    let request = build_device_cycle_request(&mut db)?;
    let request_body = serde_json::to_string(&request).map_err(|error| error.to_string())?;
    let sync_url = format!("{portal_base_url}/api/sync/device-cycle");
    drop(db);

    let client = reqwest::Client::new();
    let response = client
        .post(&sync_url)
        .headers(build_headers(&api_key)?)
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            error!(
                "Sync request failed before receiving a response: url={}, error={}, request_body={}",
                sync_url, error, request_body
            );
            error.to_string()
        })?;

    if !response.status().is_success() {
        let status_code = response.status();
        let response_body = response
            .text()
            .await
            .unwrap_or_else(|error| format!("<failed to read response body: {error}>"));
        let mut db = conn_from_app(app)?;
        let error_message = format!("Sync failed with status {}", status_code);
        let error_detail = format!(
            "POST {}\n\nRequest body:\n{}\n\nResponse body:\n{}",
            sync_url, request_body, response_body
        );
        let status = update_sync_error(&mut db, &error_message, Some(&error_detail))?;
        emit_sync_status(app, status)?;
        report_device_heartbeat(
            &client,
            &portal_base_url,
            &api_key,
            &heartbeat_event_id,
            "degraded",
            Some(&error_message),
        )
        .await;
        error!(
            "Sync cycle failed with HTTP status {}: url={}, request_body={}, response_body={}",
            status_code, sync_url, request_body, response_body
        );
        return Err(error_message);
    }

    let response_body = response.text().await.map_err(|error| error.to_string())?;
    let payload = match serde_json::from_str::<DeviceSyncCycleResponse>(&response_body) {
        Ok(payload) => payload,
        Err(error) => {
            error!(
                "Sync response JSON parse failed: url={}, error={}, response_body={}",
                sync_url, error, response_body
            );
            let error_message = format!("JSON parse error: {}", error);
            let error_detail = format!(
                "POST {}\n\nResponse body:\n{}",
                sync_url, response_body
            );
            let mut db = conn_from_app(app)?;
            let status = update_sync_error(&mut db, &error_message, Some(&error_detail))?;
            emit_sync_status(app, status)?;
            report_device_heartbeat(
                &client,
                &portal_base_url,
                &api_key,
                &heartbeat_event_id,
                "degraded",
                Some(&error_message),
            )
            .await;
            return Err(error_message);
        }
    };
    let mut db = conn_from_app(app)?;
    if let Err(error_message) = apply_cycle_response(&mut db, &payload) {
        let status = update_sync_error(&mut db, &error_message, None)?;
        emit_sync_status(app, status)?;
        report_device_heartbeat(
            &client,
            &portal_base_url,
            &api_key,
            &heartbeat_event_id,
            "degraded",
            Some(&error_message),
        )
        .await;
        return Err(error_message);
    }
    let _ = ensure_selected_event_id(&mut db)?;
    let status = load_sync_status_from_db(&mut db)?;
    emit_sync_status(app, status)?;
    report_device_heartbeat(
        &client,
        &portal_base_url,
        &api_key,
        &heartbeat_event_id,
        "online",
        None,
    )
    .await;
    info!(
        "Sync cycle completed: events={}, event_snapshots={}, rejected={}",
        payload.events.len(),
        payload.event_snapshots.len(),
        payload.rejected.len()
    );
    Ok(())
}

pub async fn sync_loop(app: AppHandle) {
    // Run an initial sync immediately on startup
    info!("Running initial sync on startup");
    match run_sync_cycle(&app).await {
        Ok(()) => info!("Initial sync completed successfully"),
        Err(error) => warn!("Initial sync failed: {}", error),
    }

    let mut last_full_cycle = Instant::now();
    let mut failure_count = 0u32;

    loop {
        let full_cycle_due = last_full_cycle.elapsed() >= Duration::from_secs(60);
        let pending = if full_cycle_due {
            // Skip the DB check — we're syncing anyway
            0
        } else {
            let state = app.state::<crate::database::AppState>();
            let _guard = state.sync_lock.lock().await;
            conn_from_app(&app)
                .and_then(|mut db| crate::database::pending_registrations_count(&mut db))
                .unwrap_or(0)
        };
        let should_sync = pending > 0 || full_cycle_due;

        if should_sync {
            match run_sync_cycle(&app).await {
                Ok(()) => {
                    failure_count = 0;
                    last_full_cycle = Instant::now();
                }
                Err(error_message) => {
                    failure_count = failure_count.saturating_add(1);
                    warn!(
                        "Sync loop iteration failed (consecutive_failures={}): {}",
                        failure_count, error_message
                    );
                }
            }
        }

        let delay_seconds = if failure_count == 0 {
            if pending > 0 {
                5
            } else {
                let remaining = 60u64.saturating_sub(last_full_cycle.elapsed().as_secs());
                remaining.max(1)
            }
        } else {
            (5u64.saturating_mul(1u64 << failure_count.saturating_sub(1).min(5))).min(300)
        };

        sleep(Duration::from_secs(delay_seconds)).await;
    }
}

#[cfg(test)]
mod tests {
    use diesel::{prelude::*, sql_query, SqliteConnection};
    use std::{fs, path::PathBuf};
    use uuid::Uuid;

    use crate::{
        database::{init_schema, load_recent_registrations, load_sync_status_from_db},
        models::{
            BaseCompetitorRow, CompetitorDeltaItem, CompetitorDeltaResponse, CourseRow,
            DeviceSyncCycleResponse, EventRow, PullData, PullPayload, RegistrationPayload,
        },
    };

    use super::apply_cycle_response;

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
    fn apply_cycle_response_updates_local_cache_and_sync_meta() {
        let mut db = open_temp_db("apply-cycle");
        sql_query("INSERT INTO outbox(local_seq, item_type, payload, created_at, status) VALUES (1, 'registration_created', '{}', '2026-03-08T10:00:00Z', 'pending')")
            .execute(&mut db)
            .expect("seed outbox");

        let payload = DeviceSyncCycleResponse {
            ack_seq_inclusive: 1,
            accepted_count: 1,
            rejected: Vec::new(),
            events: vec![EventRow {
                event_id: "event-1".to_string(),
                name: "Event".to_string(),
                start_date: Some("2026-03-08".to_string()),
            }],
            payment_groups: Vec::new(),
            map_preferences: Vec::new(),
            competition_groups: Vec::new(),
            competitor_delta: CompetitorDeltaResponse {
                current_version: 3,
                latest_row_version: 3,
                next_since_row_version: 3,
                next_after_competitor_id: "comp-1".to_string(),
                has_more: false,
                changes: vec![CompetitorDeltaItem {
                    row_version: 3,
                    competitor_id: "comp-1".to_string(),
                    change_type: "upsert".to_string(),
                    competitor: Some(BaseCompetitorRow {
                        competitor_id: "comp-1".to_string(),
                        eol_number: "500".to_string(),
                        first_name: "Test".to_string(),
                        last_name: "Runner".to_string(),
                        gender: None,
                        dob: None,
                        club: None,
                        si_card: None,
                    }),
                    changed_at: "2026-03-08T10:00:00Z".to_string(),
                }],
            },
            event_snapshots: vec![PullPayload {
                version: 7,
                mode: "snapshot".to_string(),
                data: PullData {
                    event: Some(EventRow {
                        event_id: "event-1".to_string(),
                        name: "Event".to_string(),
                        start_date: Some("2026-03-08".to_string()),
                    }),
                    competitors: Vec::new(),
                    classes: Vec::new(),
                    courses: vec![CourseRow {
                        event_id: "event-1".to_string(),
                        course_id: "course-1".to_string(),
                        class_id: "class-1".to_string(),
                        name: "Open".to_string(),
                        price_cents: 1200,
                    }],
                    filters: Vec::new(),
                    pricing: Vec::new(),
                    registrations: vec![RegistrationPayload {
                        registration_id: Uuid::new_v4().to_string(),
                        device_id: "device-1".to_string(),
                        event_id: "event-1".to_string(),
                        competitor_id: "comp-1".to_string(),
                        course_id: "course-1".to_string(),
                        competition_group_name: "Open".to_string(),
                        price_cents: 1200,
                        created_at_device: "2026-03-08T10:01:00Z".to_string(),
                        local_seq: 1,
                    }],
                },
            }],
            reserved_codes: Vec::new(),
            info_pages: Vec::new(),
        };

        apply_cycle_response(&mut db, &payload).expect("apply cycle");
        let recent = load_recent_registrations(&mut db, "event-1", 10).expect("recent");
        let sync_status = load_sync_status_from_db(&mut db).expect("sync status");

        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].competitor_id, "comp-1");
        assert_eq!(sync_status.status, "online");
        assert_eq!(sync_status.pending_registrations, 0);
    }
}
