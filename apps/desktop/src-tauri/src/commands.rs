use std::collections::HashMap;

use tauri::{AppHandle, State};

use crate::database::{
    clear_registration, conn, create_registration, emit_sync_status, ensure_selected_event_id, init_schema,
    load_competition_groups, load_device_config_map, load_event_state, load_events, load_payment_groups,
    load_sync_status_from_db, query_competitors, refresh_in_memory_sync_status,
    save_competition_group_selection, upsert_device_config_value, AppState,
};
use crate::models::{
    DesktopBootstrapResponse, DesktopClearRegistrationRequest, DesktopCreateRegistrationRequest,
    DesktopCreateRegistrationResponse, DesktopEventState, DesktopQueryCompetitorsRequest,
    DesktopQueryCompetitorsResponse, DesktopSetCompetitionGroupRequest, DesktopSyncStatus,
    SELECTED_EVENT_KEY,
};

#[tauri::command]
pub fn init_db(state: State<AppState>) -> Result<(), String> {
    let mut db = conn(&state)?;
    init_schema(&mut db)
}

#[tauri::command]
pub fn get_device_config(state: State<AppState>) -> Result<HashMap<String, String>, String> {
    let mut db = conn(&state)?;
    load_device_config_map(&mut db)
}

#[tauri::command]
pub fn set_device_config(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let mut db = conn(&state)?;
    upsert_device_config_value(&mut db, &key, &value).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_bootstrap(state: State<AppState>) -> Result<DesktopBootstrapResponse, String> {
    let mut db = conn(&state)?;
    let selected_event_id = ensure_selected_event_id(&mut db)?;
    Ok(DesktopBootstrapResponse {
        events: load_events(&mut db)?,
        payment_groups: load_payment_groups(&mut db)?,
        competition_groups: load_competition_groups(&mut db)?,
        sync_status: load_sync_status_from_db(&mut db)?,
        event_state: load_event_state(&mut db, &selected_event_id)?,
        query_result: query_competitors(
            &mut db,
            DesktopQueryCompetitorsRequest {
                filter_id: "all".to_string(),
                query: String::new(),
            },
        )?,
    })
}

#[tauri::command]
pub fn desktop_query_competitors(
    state: State<AppState>,
    request: DesktopQueryCompetitorsRequest,
) -> Result<DesktopQueryCompetitorsResponse, String> {
    let mut db = conn(&state)?;
    query_competitors(&mut db, request)
}

#[tauri::command]
pub fn desktop_select_event(state: State<AppState>, event_id: String) -> Result<DesktopEventState, String> {
    let mut db = conn(&state)?;
    upsert_device_config_value(&mut db, SELECTED_EVENT_KEY, &event_id).map_err(|error| error.to_string())?;
    load_event_state(&mut db, &event_id)
}

#[tauri::command]
pub fn desktop_set_competition_group(
    state: State<'_, AppState>,
    request: DesktopSetCompetitionGroupRequest,
) -> Result<(), String> {
    let mut db = conn(&state)?;
    save_competition_group_selection(&mut db, request)
}

#[tauri::command]
pub async fn desktop_create_registration(
    app: AppHandle,
    state: State<'_, AppState>,
    request: DesktopCreateRegistrationRequest,
) -> Result<DesktopCreateRegistrationResponse, String> {
    let mut db = conn(&state)?;
    let response = create_registration(&mut db, request)?;
    let status = load_sync_status_from_db(&mut db)?;
    emit_sync_status(&app, status)?;
    tauri::async_runtime::spawn({
        let app_handle = app.clone();
        async move {
            let _ = crate::sync::run_sync_cycle(&app_handle).await;
        }
    });
    Ok(response)
}

#[tauri::command]
pub fn desktop_clear_registration(
    app: AppHandle,
    state: State<'_, AppState>,
    request: DesktopClearRegistrationRequest,
) -> Result<DesktopEventState, String> {
    let mut db = conn(&state)?;
    let response = clear_registration(&mut db, request)?;
    let status = load_sync_status_from_db(&mut db)?;
    emit_sync_status(&app, status)?;
    Ok(response)
}

#[tauri::command]
pub fn desktop_get_sync_status(app: AppHandle) -> Result<DesktopSyncStatus, String> {
    refresh_in_memory_sync_status(&app)
}
