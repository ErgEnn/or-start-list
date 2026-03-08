#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use diesel::{
    connection::SimpleConnection,
    prelude::*,
    sql_query,
    sql_types::{BigInt, Nullable, Text},
    QueryableByName, SqliteConnection,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};

mod db_sql;

#[derive(Default)]
struct AppState {
    db_path: Mutex<Option<PathBuf>>,
}

#[derive(Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
struct CompetitorRow {
    #[diesel(sql_type = Text)]
    competitor_id: String,
    #[diesel(sql_type = Text)]
    eol_number: String,
    #[diesel(sql_type = Text)]
    first_name: String,
    #[diesel(sql_type = Text)]
    last_name: String,
    #[diesel(sql_type = Nullable<Text>)]
    club: Option<String>,
}

#[derive(Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
struct CourseRow {
    #[diesel(sql_type = Text)]
    course_id: String,
    #[diesel(sql_type = Text)]
    class_id: String,
    #[diesel(sql_type = Text)]
    name: String,
    #[diesel(sql_type = BigInt)]
    price_cents: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistrationPayload {
    registration_id: String,
    device_id: String,
    event_id: String,
    competitor_id: String,
    course_id: String,
    price_cents: i64,
    created_at_device: String,
    local_seq: i64,
}

#[derive(Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
struct RegistrationRow {
    #[diesel(sql_type = Text)]
    registration_id: String,
    #[diesel(sql_type = Text)]
    competitor_name: String,
    #[diesel(sql_type = Text)]
    course_name: String,
    #[diesel(sql_type = BigInt)]
    price_cents: i64,
    #[diesel(sql_type = Text)]
    created_at_device: String,
}

#[derive(Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
struct SyncStateRow {
    #[diesel(sql_type = Text)]
    device_id: String,
    #[diesel(sql_type = Text)]
    event_id: String,
    #[diesel(sql_type = BigInt)]
    last_pulled_version: i64,
    #[diesel(sql_type = BigInt)]
    last_pushed_seq_ack: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClassRow {
    class_id: String,
    event_id: String,
    name: String,
    short_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilterRow {
    filter_id: String,
    event_id: String,
    name: String,
    query_definition: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PricingRow {
    pricing_rule_id: String,
    event_id: String,
    rule_name: String,
    payload: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullData {
    competitors: Vec<CompetitorRow>,
    classes: Vec<ClassRow>,
    courses: Vec<CourseRow>,
    filters: Vec<FilterRow>,
    pricing: Vec<PricingRow>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullPayload {
    version: i64,
    mode: String,
    data: PullData,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutboxItem {
    local_seq: i64,
    #[serde(rename = "type")]
    item_type: String,
    payload: RegistrationPayload,
    created_at: String,
    status: String,
}

#[derive(QueryableByName)]
struct SeqRow {
    #[diesel(sql_type = BigInt)]
    next_seq: i64,
}

#[derive(QueryableByName)]
struct OutboxRaw {
    #[diesel(sql_type = BigInt)]
    local_seq: i64,
    #[diesel(sql_type = Text)]
    item_type: String,
    #[diesel(sql_type = Text)]
    payload_text: String,
    #[diesel(sql_type = Text)]
    created_at: String,
    #[diesel(sql_type = Text)]
    status: String,
}

#[derive(QueryableByName)]
struct DeviceConfigRow {
    #[diesel(sql_type = Text)]
    config_key: String,
    #[diesel(sql_type = Text)]
    config_value: String,
}

fn db_path(state: &State<AppState>) -> Result<PathBuf, String> {
    state
        .db_path
        .lock()
        .map_err(|_| "State lock failed".to_string())?
        .clone()
        .ok_or_else(|| "Database is not initialized".to_string())
}

fn conn(state: &State<AppState>) -> Result<SqliteConnection, String> {
    let db_file = db_path(state)?;
    SqliteConnection::establish(&db_file.to_string_lossy()).map_err(|e| e.to_string())
}

fn init_schema(conn: &mut SqliteConnection) -> Result<(), String> {
    conn.batch_execute(db_sql::SCHEMA)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn init_db(state: State<AppState>) -> Result<(), String> {
    let mut db = conn(&state)?;
    init_schema(&mut db)
}

#[tauri::command]
fn list_competitors_by_letter(state: State<AppState>, letter: String) -> Result<Vec<CompetitorRow>, String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::LIST_COMPETITORS_BY_LETTER)
    .bind::<Text, _>(letter)
    .load::<CompetitorRow>(&mut db)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn search_competitors(state: State<AppState>, query: String) -> Result<Vec<CompetitorRow>, String> {
    let mut db = conn(&state)?;
    let wildcard = format!("%{query}%");
    sql_query(db_sql::SEARCH_COMPETITORS)
    .bind::<Text, _>(query)
    .bind::<Text, _>(wildcard)
    .load::<CompetitorRow>(&mut db)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_courses(state: State<AppState>) -> Result<Vec<CourseRow>, String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::LIST_COURSES)
        .load::<CourseRow>(&mut db)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_registration(state: State<AppState>, payload: RegistrationPayload) -> Result<(), String> {
    let mut db = conn(&state)?;
    db.transaction::<(), diesel::result::Error, _>(|conn| {
        let seq = sql_query(db_sql::NEXT_REGISTRATION_SEQ)
            .get_result::<SeqRow>(conn)?
            .next_seq;

        let RegistrationPayload {
            registration_id,
            device_id,
            event_id,
            competitor_id,
            course_id,
            price_cents,
            created_at_device,
            local_seq: _,
        } = payload;

        sql_query(db_sql::INSERT_REGISTRATION)
        .bind::<Text, _>(&registration_id)
        .bind::<Text, _>(&device_id)
        .bind::<Text, _>(&event_id)
        .bind::<Text, _>(&competitor_id)
        .bind::<Text, _>(&course_id)
        .bind::<BigInt, _>(price_cents)
        .bind::<Text, _>(&created_at_device)
        .bind::<BigInt, _>(seq)
        .execute(conn)?;

        let outbox_payload = serde_json::json!({
            "registrationId": registration_id,
            "deviceId": device_id,
            "eventId": event_id,
            "competitorId": competitor_id,
            "courseId": course_id,
            "priceCents": price_cents,
            "createdAtDevice": created_at_device,
            "localSeq": seq
        });

        sql_query(db_sql::INSERT_OUTBOX_REGISTRATION_CREATED)
        .bind::<BigInt, _>(seq)
        .bind::<Text, _>(outbox_payload.to_string())
        .execute(conn)?;

        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recent_registrations(state: State<AppState>, limit: i64) -> Result<Vec<RegistrationRow>, String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::GET_RECENT_REGISTRATIONS)
    .bind::<BigInt, _>(limit)
    .load::<RegistrationRow>(&mut db)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sync_state(state: State<AppState>) -> Result<SyncStateRow, String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::GET_SYNC_STATE)
    .get_result::<SyncStateRow>(&mut db)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_sync_state(state: State<AppState>, payload: SyncStateRow) -> Result<(), String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::UPDATE_SYNC_STATE)
    .bind::<Text, _>(payload.device_id)
    .bind::<Text, _>(payload.event_id)
    .bind::<BigInt, _>(payload.last_pulled_version)
    .bind::<BigInt, _>(payload.last_pushed_seq_ack)
    .execute(&mut db)
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_pending_outbox(state: State<AppState>, after_seq_exclusive: i64) -> Result<Vec<OutboxItem>, String> {
    let mut db = conn(&state)?;
    let rows = sql_query(db_sql::GET_PENDING_OUTBOX)
    .bind::<BigInt, _>(after_seq_exclusive)
    .load::<OutboxRaw>(&mut db)
    .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|row| {
            let payload: RegistrationPayload =
                serde_json::from_str(&row.payload_text).map_err(|e| e.to_string())?;
            Ok(OutboxItem {
                local_seq: row.local_seq,
                item_type: row.item_type,
                payload,
                created_at: row.created_at,
                status: row.status,
            })
        })
        .collect()
}

#[tauri::command]
fn mark_outbox_synced(state: State<AppState>, ack_seq_inclusive: i64) -> Result<(), String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::MARK_OUTBOX_SYNCED)
        .bind::<BigInt, _>(ack_seq_inclusive)
        .execute(&mut db)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn apply_pull_snapshot(state: State<AppState>, payload: PullPayload) -> Result<(), String> {
    let mut db = conn(&state)?;
    let PullPayload { version: _, mode: _, data } = payload;
    let PullData {
        competitors,
        classes,
        courses,
        filters,
        pricing,
    } = data;

    db.transaction::<(), diesel::result::Error, _>(|conn| {
        sql_query(db_sql::DELETE_COMPETITORS).execute(conn)?;
        sql_query(db_sql::DELETE_CLASSES).execute(conn)?;
        sql_query(db_sql::DELETE_COURSES).execute(conn)?;
        sql_query(db_sql::DELETE_QUICK_FILTERS).execute(conn)?;
        sql_query(db_sql::DELETE_PRICING_RULES).execute(conn)?;

        for c in competitors {
            sql_query(db_sql::INSERT_COMPETITOR)
            .bind::<Text, _>(c.competitor_id)
            .bind::<Text, _>(c.eol_number)
            .bind::<Text, _>(c.first_name)
            .bind::<Text, _>(c.last_name)
            .bind::<Nullable<Text>, _>(c.club.as_deref())
            .execute(conn)?;
        }
        for c in classes {
            sql_query(db_sql::INSERT_CLASS)
                .bind::<Text, _>(c.class_id)
                .bind::<Text, _>(c.event_id)
                .bind::<Text, _>(c.name)
                .bind::<Text, _>(c.short_name)
                .execute(conn)?;
        }
        for c in courses {
            sql_query(db_sql::INSERT_COURSE)
                .bind::<Text, _>(c.course_id)
                .bind::<Text, _>(c.class_id)
                .bind::<Text, _>(c.name)
                .bind::<BigInt, _>(c.price_cents)
                .execute(conn)?;
        }
        for f in filters {
            sql_query(db_sql::INSERT_QUICK_FILTER)
            .bind::<Text, _>(f.filter_id)
            .bind::<Text, _>(f.event_id)
            .bind::<Text, _>(f.name)
            .bind::<Text, _>(f.query_definition)
            .execute(conn)?;
        }
        for p in pricing {
            sql_query(db_sql::INSERT_PRICING_RULE)
                .bind::<Text, _>(p.pricing_rule_id)
                .bind::<Text, _>(p.event_id)
                .bind::<Text, _>(p.rule_name)
                .bind::<Text, _>(p.payload.to_string())
                .execute(conn)?;
        }

        Ok(())
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_device_config(state: State<AppState>) -> Result<HashMap<String, String>, String> {
    let mut db = conn(&state)?;
    let rows = sql_query(db_sql::GET_DEVICE_CONFIG)
        .load::<DeviceConfigRow>(&mut db)
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| (row.config_key, row.config_value))
        .collect())
}

#[tauri::command]
fn set_device_config(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let mut db = conn(&state)?;
    sql_query(db_sql::SET_DEVICE_CONFIG)
    .bind::<Text, _>(key)
    .bind::<Text, _>(value)
    .execute(&mut db)
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
            let path = data_dir.join("or_start_list.sqlite");
            let state = app.state::<AppState>();
            let mut guard = state.db_path.lock().map_err(|_| "State lock failed".to_string())?;
            *guard = Some(path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_db,
            list_competitors_by_letter,
            search_competitors,
            list_courses,
            create_registration,
            get_recent_registrations,
            get_sync_state,
            update_sync_state,
            get_pending_outbox,
            mark_outbox_synced,
            apply_pull_snapshot,
            get_device_config,
            set_device_config
        ])
        .run(tauri::generate_context!())
        .expect("tauri app error");
}
