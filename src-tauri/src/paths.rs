//! Standard application path resolution for Lattice.

use std::path::PathBuf;
use std::sync::RwLock;
use crate::errors::AuthError;

static APP_DATA_DIR: RwLock<Option<PathBuf>> = RwLock::new(None);

/// Sets a custom application data directory (e.g. from Electron app.getPath('userData')).
pub fn set_data_dir(dir: PathBuf) {
    let mut guard = APP_DATA_DIR.write().unwrap();
    *guard = Some(dir);
}

/// Resolves the application data directory.
pub fn app_data_dir() -> Result<PathBuf, AuthError> {
    let guard = APP_DATA_DIR.read().unwrap();
    let dir = if let Some(ref d) = *guard {
        d.clone()
    } else {
        // Fallback default: ~/.local/share/com.lattice.app
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).map_err(|e| AuthError::Io(e.to_string()))?;
        PathBuf::from(home).join(".local/share/com.lattice.app")
    };

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| AuthError::Io(e.to_string()))?;
    }

    Ok(dir)
}

/// Resolves the vault directory (`<app_data_dir>/vault`).
pub fn vault_dir() -> Result<PathBuf, AuthError> {
    let dir = app_data_dir()?.join("vault");
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| AuthError::Io(e.to_string()))?;
    }
    Ok(dir)
}

/// Resolves the path to the encrypted SQLCipher vault database (`<vault_dir>/vault.db`).
pub fn vault_db_path() -> Result<PathBuf, AuthError> {
    Ok(vault_dir()?.join("vault.db"))
}

/// Resolves the path to the vault Argon2id salt file (`<vault_dir>/vault.salt`).
pub fn vault_salt_path() -> Result<PathBuf, AuthError> {
    Ok(vault_dir()?.join("vault.salt"))
}

/// Resolves the canvases directory (`<app_data_dir>/canvases`).
pub fn canvases_dir() -> Result<PathBuf, AuthError> {
    let dir = app_data_dir()?.join("canvases");
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| AuthError::Io(e.to_string()))?;
    }
    Ok(dir)
}

/// Resolves the path to a canvas SQLCipher database (`<canvases_dir>/<canvas_id>.db`).
pub fn canvas_db_path(canvas_id: &str) -> Result<PathBuf, AuthError> {
    Ok(canvases_dir()?.join(format!("{}.db", canvas_id)))
}

/// Resolves the path to a canvas Argon2id salt file (`<canvases_dir>/<canvas_id>.salt`).
pub fn canvas_salt_path(canvas_id: &str) -> Result<PathBuf, AuthError> {
    Ok(canvases_dir()?.join(format!("{}.salt", canvas_id)))
}
