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
        let home = std::env::var("HOME").map_err(|e| AuthError::Io(e.to_string()))?;
        PathBuf::from(home).join(".local/share/com.lattice.app")
    };

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| AuthError::Io(e.to_string()))?;
    }

    Ok(dir)
}

/// Resolves the path to the encrypted SQLCipher database (`lattice.db`).
pub fn db_path() -> Result<PathBuf, AuthError> {
    Ok(app_data_dir()?.join("lattice.db"))
}

/// Resolves the path to the master Argon2id salt file (`lattice.salt`).
pub fn salt_path() -> Result<PathBuf, AuthError> {
    Ok(app_data_dir()?.join("lattice.salt"))
}
