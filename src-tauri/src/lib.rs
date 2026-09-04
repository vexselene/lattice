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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(std::sync::Mutex::new(state::AppState::new()))
        .manage(tokio::sync::Mutex::new(()))
        .invoke_handler(tauri::generate_handler![
            commands::auth::cmd_auth_setup,
            commands::auth::cmd_auth_unlock,
            commands::auth::cmd_auth_lock,
            commands::auth::cmd_auth_status,
            commands::auth::cmd_update_settings,
            commands::graph::cmd_get_graph,
            commands::graph::cmd_get_nodes,
            commands::graph::cmd_get_node,
            commands::graph::cmd_create_node,
            commands::graph::cmd_update_node,
            commands::graph::cmd_delete_node,
            commands::graph::cmd_get_node_password,
            commands::graph::cmd_update_node_position,
            commands::graph::cmd_get_edges,
            commands::graph::cmd_create_edge,
            commands::graph::cmd_update_edge,
            commands::graph::cmd_delete_edge,
            commands::graph::cmd_get_subgraph,
            commands::graph::cmd_search,
            commands::graph::cmd_generate_password,
            commands::graph::cmd_export_save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
