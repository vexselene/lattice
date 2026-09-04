pub mod commands;
pub mod crypto;
pub mod errors;
pub mod models;
pub mod paths;
pub mod schema;
pub mod state;

pub use commands::auth::{
    init_app, cmd_auth_lock, cmd_auth_setup, cmd_auth_status, cmd_auth_unlock, cmd_update_settings,
};

use napi_derive::napi;

#[napi]
pub fn cmd_generate_password() -> serde_json::Value {
    commands::graph::generate_password_core().unwrap_or_else(|_| serde_json::json!({ "password": "" }))
}
