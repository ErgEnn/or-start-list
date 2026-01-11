// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod db;

use db::{Database, Registration};
use std::sync::Arc;
use tauri::{Manager, State};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_registration(
    db: State<Arc<Database>>,
    registration: Registration,
) -> Result<i64, String> {
    db.insert_registration(&registration)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_registrations(db: State<Arc<Database>>) -> Result<Vec<Registration>, String> {
    db.get_all_registrations()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recent_registrations(
    db: State<Arc<Database>>,
    limit: usize,
) -> Result<Vec<Registration>, String> {
    db.get_recent_registrations(limit)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get the app data directory
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            // Create the directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            
            // Create the database path
            let db_path = app_data_dir.join("registrations.db");
            
            // Initialize the database
            let database = Database::new(db_path.to_str().unwrap())
                .expect("Failed to initialize database");
            
            // Store the database in app state
            app.manage(Arc::new(database));
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            save_registration,
            get_all_registrations,
            get_recent_registrations
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
