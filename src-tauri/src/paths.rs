//! Standard application path resolution for Lattice.

use std::path::PathBuf;
use tauri::Manager;
use crate::errors::AuthError;

/// Resolves the application data directory using Tauri v2's PathResolver
/// and ensures that the directory exists on disk.
pub fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, AuthError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AuthError::Io(e.to_string()))?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| AuthError::Io(e.to_string()))?;
    }

    Ok(dir)
}

/// Resolves the path to the encrypted SQLCipher database (`lattice.db`).
pub fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, AuthError> {
    Ok(app_data_dir(app)?.join("lattice.db"))
}

/// Resolves the path to the master Argon2id salt file (`lattice.salt`).
pub fn salt_path(app: &tauri::AppHandle) -> Result<PathBuf, AuthError> {
    Ok(app_data_dir(app)?.join("lattice.salt"))
}
