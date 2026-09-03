pub mod commands;
pub mod crypto;
pub mod errors;
pub mod models;
pub mod paths;
pub mod schema;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Mutex::new(state::AppState::new()))
        .manage(tokio::sync::Mutex::new(()))
        .invoke_handler(tauri::generate_handler![
            commands::auth::cmd_auth_setup,
            commands::auth::cmd_auth_unlock,
            commands::auth::cmd_auth_lock,
            commands::auth::cmd_auth_status,
            commands::auth::cmd_update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
