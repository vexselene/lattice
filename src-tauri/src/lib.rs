#[tauri::command]
fn cmd_ping() -> Result<String, String> {
    println!("[Rust IPC] cmd_ping called! Returning pong");
    Ok("pong".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![cmd_ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
