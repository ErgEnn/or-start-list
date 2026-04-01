mod commands;
mod database;
mod models;
mod si_reader;
mod sync;

use std::{fs::OpenOptions, path::PathBuf};

use log::info;
use simplelog::{ConfigBuilder, LevelFilter, WriteLogger};
use tauri::Manager;

use crate::database::{conn, init_schema, load_sync_status_from_db, AppState};

fn init_file_logger(log_file: PathBuf) -> Result<(), String> {
    let logger_config = ConfigBuilder::new()
        .set_time_format_rfc3339()
        .build();
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|error| format!("Failed to open log file {}: {error}", log_file.display()))?;

    WriteLogger::init(LevelFilter::Info, logger_config, file)
        .map_err(|error| format!("Failed to initialize logger: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .manage(si_reader::SiReaderState::default())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
            std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
            let log_dir = app.path().app_log_dir().map_err(|error| error.to_string())?;
            std::fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;

            let log_file = log_dir.join("backend.log");
            init_file_logger(log_file.clone())?;
            info!("Backend logger initialized at {}", log_file.display());

            let db_file = data_dir.join("or_start_list.sqlite");
            info!("Using application data directory {}", data_dir.display());
            info!("Using sqlite database {}", db_file.display());

            {
                let state = app.state::<AppState>();
                let mut guard = state
                    .db_path
                    .lock()
                    .map_err(|_| "State lock failed".to_string())?;
                *guard = Some(db_file);
            }

            {
                let state = app.state::<AppState>();
                let mut db = conn(&state)?;
                init_schema(&mut db)?;
                let status = load_sync_status_from_db(&mut db)?;
                let mut guard = state
                    .sync_status
                    .lock()
                    .map_err(|_| "State lock failed".to_string())?;
                *guard = status;
            }

            info!("Database schema ready and sync status loaded");
            tauri::async_runtime::spawn(sync::sync_loop(app.handle().clone()));
            info!("Background sync loop started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::init_db,
            commands::get_device_config,
            commands::set_device_config,
            commands::desktop_bootstrap,
            commands::desktop_query_competitors,
            commands::desktop_select_event,
            commands::desktop_set_competition_group,
            commands::desktop_create_registration,
            commands::desktop_clear_registration,
            commands::desktop_update_registration_payment,
            commands::desktop_get_sync_status,
            commands::desktop_get_reserved_codes,
            commands::desktop_claim_reserved_code,
            commands::desktop_force_sync,
            commands::si_connect,
            commands::si_disconnect,
            commands::si_get_status,
        ])
        .run(tauri::generate_context!())
        .expect("tauri app error");
}
