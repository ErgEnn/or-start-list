use std::collections::HashMap;

use tauri::{AppHandle, Manager, State};

use crate::database::{
    claim_reserved_code, clear_registration, conn, create_registration, emit_sync_status, init_schema,
    load_all_registrations, load_available_reserved_codes, load_competition_groups, load_device_config_map,
    load_event_state, load_events, load_info_pages, load_map_preferences, load_payment_groups, load_sync_status_from_db, query_competitors,
    refresh_in_memory_sync_status, reset_competitor_sync_state, save_competition_group_selection,
    ensure_selected_event_id, update_registration_payment, upsert_device_config_value, AppState,
};
use crate::si_reader::{self, SiReaderState};
use crate::models::{
    AllRegistrationRow, DesktopBootstrapResponse, DesktopClaimReservedCodeRequest, DesktopClearRegistrationRequest,
    DesktopCreateRegistrationRequest, DesktopCreateRegistrationResponse, DesktopEventState,
    DesktopUpdateRegistrationPaymentRequest,
    DesktopQueryCompetitorsRequest, DesktopQueryCompetitorsResponse,
    DesktopSetCompetitionGroupRequest, DesktopSyncStatus, ReservedCodePayload, SELECTED_EVENT_KEY,
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
        map_preferences: load_map_preferences(&mut db)?,
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
        info_pages: load_info_pages(&mut db)?,
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
pub async fn desktop_update_registration_payment(
    app: AppHandle,
    state: State<'_, AppState>,
    request: DesktopUpdateRegistrationPaymentRequest,
) -> Result<DesktopCreateRegistrationResponse, String> {
    let mut db = conn(&state)?;
    let response = update_registration_payment(&mut db, request)?;
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
pub fn desktop_get_all_registrations(
    state: State<AppState>,
    event_id: String,
) -> Result<Vec<AllRegistrationRow>, String> {
    let mut db = conn(&state)?;
    load_all_registrations(&mut db, &event_id)
}

#[tauri::command]
pub fn desktop_get_reserved_codes(state: State<AppState>) -> Result<Vec<ReservedCodePayload>, String> {
    let mut db = conn(&state)?;
    load_available_reserved_codes(&mut db)
}

#[tauri::command]
pub async fn desktop_claim_reserved_code(
    app: AppHandle,
    state: State<'_, AppState>,
    request: DesktopClaimReservedCodeRequest,
) -> Result<DesktopCreateRegistrationResponse, String> {
    let mut db = conn(&state)?;
    let response = claim_reserved_code(&mut db, request)?;
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
pub fn desktop_get_sync_status(app: AppHandle) -> Result<DesktopSyncStatus, String> {
    refresh_in_memory_sync_status(&app)
}

#[tauri::command]
pub async fn desktop_force_sync(app: AppHandle) -> Result<(), String> {
    crate::sync::run_sync_cycle(&app).await
}

#[tauri::command]
pub async fn desktop_refresh_competitors(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut db = conn(&state)?;
        reset_competitor_sync_state(&mut db)?;
    }
    crate::sync::run_sync_cycle(&app).await
}

#[tauri::command]
pub async fn si_connect(app: AppHandle) -> Result<(), String> {
    let port_name = si_reader::find_si_port()?;

    {
        let state = app.state::<SiReaderState>();
        let already_connected = *state.connected.lock().map_err(|_| "Lock failed".to_string())?;
        if already_connected {
            return Err("SI reader already connected".to_string());
        }
    }

    // Open port synchronously so errors (e.g. permission denied) are returned to frontend
    let port = si_reader::open_si_port(&port_name)?;

    {
        let state = app.state::<SiReaderState>();
        *state.cancel_flag.lock().map_err(|_| "Lock failed".to_string())? = false;
        *state.connected.lock().map_err(|_| "Lock failed".to_string())? = true;
    }

    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        si_reader::read_loop(app_clone, port);
    });

    Ok(())
}

#[tauri::command]
pub fn si_disconnect(app: AppHandle) -> Result<(), String> {
    let state = app.state::<SiReaderState>();
    *state.cancel_flag.lock().map_err(|_| "Lock failed".to_string())? = true;
    Ok(())
}

#[tauri::command]
pub fn si_get_status(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<SiReaderState>();
    let connected = *state.connected.lock().map_err(|_| "Lock failed".to_string())?;
    Ok(connected)
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}
