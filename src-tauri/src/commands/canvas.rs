//! Canvas lifecycle management commands for Lattice.
//!
//! Provides two-tier canvas operations: listing, creating, opening, closing,
//! renaming, duplicating, deleting, exporting, and importing encrypted canvases.

use std::sync::Mutex;
use std::time::Duration;

use crate::commands::auth::is_sqlcipher_key_error;
use crate::crypto;
use crate::errors::AuthError;
use crate::models::CanvasSummary;
use crate::paths;
use crate::schema;
use crate::state::{ActiveCanvas, AppState, BackoffError};

pub const BUNDLE_MAGIC: &[u8; 8] = b"LATTICE1";

/// Serializes canvas metadata, salt, and SQLCipher database into a standalone bundle format.
///
/// Binary layout:
/// - 8 bytes: "LATTICE1"
/// - 4 bytes: u32 LE length of canvas name
/// - N bytes: UTF-8 canvas name (plaintext)
/// - 4 bytes: u32 LE length of salt file
/// - M bytes: salt raw bytes
/// - 8 bytes: u64 LE length of db file
/// - K bytes: db raw bytes
pub fn encode_bundle(name: &str, salt_bytes: &[u8], db_bytes: &[u8]) -> Vec<u8> {
    let name_bytes = name.as_bytes();
    let total_size = 8 + 4 + name_bytes.len() + 4 + salt_bytes.len() + 8 + db_bytes.len();
    let mut buf = Vec::with_capacity(total_size);

    buf.extend_from_slice(BUNDLE_MAGIC);
    buf.extend_from_slice(&(name_bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(name_bytes);
    buf.extend_from_slice(&(salt_bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(salt_bytes);
    buf.extend_from_slice(&(db_bytes.len() as u64).to_le_bytes());
    buf.extend_from_slice(db_bytes);

    buf
}

/// Parses and validates a canvas bundle from raw bytes.
pub fn decode_bundle(bytes: &[u8]) -> Result<(String, Vec<u8>, Vec<u8>), AuthError> {
    if bytes.len() < 24 {
        return Err(AuthError::InvalidBundle(
            "Bundle is too small to be valid".into(),
        ));
    }

    if &bytes[0..8] != BUNDLE_MAGIC {
        return Err(AuthError::InvalidBundle(
            "Invalid bundle magic bytes: not a Lattice bundle".into(),
        ));
    }

    let mut offset = 8;

    let name_len = u32::from_le_bytes(
        bytes[offset..offset + 4]
            .try_into()
            .map_err(|_| AuthError::InvalidBundle("Malformed name length".into()))?,
    ) as usize;
    offset += 4;

    if bytes.len() < offset + name_len {
        return Err(AuthError::InvalidBundle(
            "Truncated bundle: missing canvas name".into(),
        ));
    }
    let name = String::from_utf8(bytes[offset..offset + name_len].to_vec())
        .map_err(|e| AuthError::InvalidBundle(format!("Canvas name is not valid UTF-8: {}", e)))?;
    offset += name_len;

    if bytes.len() < offset + 4 {
        return Err(AuthError::InvalidBundle(
            "Truncated bundle: missing salt length".into(),
        ));
    }
    let salt_len = u32::from_le_bytes(
        bytes[offset..offset + 4]
            .try_into()
            .map_err(|_| AuthError::InvalidBundle("Malformed salt length".into()))?,
    ) as usize;
    offset += 4;

    if bytes.len() < offset + salt_len {
        return Err(AuthError::InvalidBundle(
            "Truncated bundle: missing salt bytes".into(),
        ));
    }
    let salt_bytes = bytes[offset..offset + salt_len].to_vec();
    offset += salt_len;

    if bytes.len() < offset + 8 {
        return Err(AuthError::InvalidBundle(
            "Truncated bundle: missing database length".into(),
        ));
    }
    let db_len = u64::from_le_bytes(
        bytes[offset..offset + 8]
            .try_into()
            .map_err(|_| AuthError::InvalidBundle("Malformed database length".into()))?,
    ) as usize;
    offset += 8;

    if bytes.len() < offset + db_len {
        return Err(AuthError::InvalidBundle(
            "Truncated bundle: missing database content".into(),
        ));
    }
    let db_bytes = bytes[offset..offset + db_len].to_vec();

    Ok((name, salt_bytes, db_bytes))
}

// =========================================================================
// Core Business Logic
// =========================================================================

/// Lists all canvases recorded in the unlocked vault registry, ordered by `modified_at` descending.
pub fn list_canvases_core(state: &Mutex<AppState>) -> Result<Vec<CanvasSummary>, AuthError> {
    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let mut stmt = vault_conn
        .prepare("SELECT id, name, created_at, modified_at FROM canvases ORDER BY modified_at DESC")
        .map_err(|e| AuthError::Database(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CanvasSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                modified_at: row.get(3)?,
            })
        })
        .map_err(|e| AuthError::Database(e.to_string()))?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| AuthError::Database(e.to_string()))?);
    }

    Ok(list)
}

/// Creates a new canvas database encrypted with its own Argon2id-derived key and registers it in the vault.
pub async fn create_canvas_core(
    state: &Mutex<AppState>,
    name: String,
    password: String,
) -> Result<CanvasSummary, AuthError> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err(AuthError::Validation("Canvas name cannot be empty".into()));
    }

    // Verify vault is unlocked and name does not already exist (case-insensitive, trimmed)
    {
        let state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
        let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

        let name_exists: bool = vault_conn
            .query_row(
                "SELECT 1 FROM canvases WHERE lower(trim(name)) = lower(?1)",
                rusqlite::params![trimmed_name],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if name_exists {
            return Err(AuthError::NameAlreadyExists);
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let salt = crypto::generate_salt();
    let salt_file = paths::canvas_salt_path(&id)?;
    let db_file = paths::canvas_db_path(&id)?;

    // Ensure parent directories exist
    if let Some(parent) = salt_file.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }

    // Write salt file
    std::fs::write(&salt_file, salt).map_err(|e| AuthError::Io(e.to_string()))?;

    // Offload Argon2 KDF + SQLCipher creation & schema init to blocking thread
    let db_file_owned = db_file.clone();
    let password_owned = password;
    let create_res = tokio::task::spawn_blocking(move || {
        let key = crypto::derive_master_key(&password_owned, &salt);
        let conn_res = (|| -> Result<(), rusqlite::Error> {
            let conn = rusqlite::Connection::open(&db_file_owned)?;
            let hex_key: String = key.iter().map(|b| format!("{:02x}", b)).collect();
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))?;
            schema::configure_connection(&conn)?;
            schema::create_schema(&conn)?;
            Ok(())
        })();
        conn_res
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

    if let Err(err) = create_res {
        let _ = std::fs::remove_file(&salt_file);
        let _ = std::fs::remove_file(&db_file);
        return Err(AuthError::Database(err.to_string()));
    }

    // Insert registry row into vault DB
    let now = chrono::Utc::now().to_rfc3339();
    let file_name = format!("{}.db", id);
    let summary = CanvasSummary {
        id: id.clone(),
        name: trimmed_name.to_string(),
        created_at: now.clone(),
        modified_at: now.clone(),
    };

    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = match state_guard.vault_db.as_ref() {
        Some(conn) => conn,
        None => {
            let _ = std::fs::remove_file(&salt_file);
            let _ = std::fs::remove_file(&db_file);
            return Err(AuthError::NotUnlocked);
        }
    };

    let insert_res = vault_conn.execute(
        "INSERT INTO canvases (id, name, file_name, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![&id, trimmed_name, &file_name, &now, &now],
    );

    if let Err(err) = insert_res {
        let _ = std::fs::remove_file(&salt_file);
        let _ = std::fs::remove_file(&db_file);
        return Err(AuthError::Database(err.to_string()));
    }

    Ok(summary)
}

/// Opens a canvas database by verifying its password and registering it as `state.active_canvas`.
pub async fn open_canvas_core(
    state: &Mutex<AppState>,
    id: String,
    password: String,
) -> Result<(), AuthError> {
    // 1. Check preconditions and backoff rate-limit
    let delay_to_sleep = {
        let state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;

        let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

        if state_guard.active_canvas.is_some() {
            return Err(AuthError::CanvasAlreadyActive);
        }

        let canvas_exists: bool = vault_conn
            .query_row(
                "SELECT 1 FROM canvases WHERE id = ?1",
                rusqlite::params![&id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !canvas_exists {
            return Err(AuthError::NotFound(format!("Canvas {} not found", id)));
        }

        match state_guard.check_attempt() {
            Err(BackoffError::RateLimited { wait_remaining }) => {
                return Err(AuthError::RateLimited {
                    wait_remaining_ms: wait_remaining.as_millis() as u64,
                });
            }
            Ok(delay) if delay > Duration::ZERO => Some(delay),
            _ => None,
        }
    };

    if let Some(delay) = delay_to_sleep {
        tokio::time::sleep(delay).await;
    }

    // 2. Read canvas salt
    let salt_file = paths::canvas_salt_path(&id)?;
    let salt_bytes = std::fs::read(&salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
    if salt_bytes.len() != crypto::SALT_SIZE {
        return Err(AuthError::Io(format!(
            "Invalid canvas salt file length: expected {}, got {}",
            crypto::SALT_SIZE,
            salt_bytes.len()
        )));
    }
    let mut salt = [0u8; crypto::SALT_SIZE];
    salt.copy_from_slice(&salt_bytes);

    // 3. Derive key and open/verify canvas database on worker thread
    let db_file = paths::canvas_db_path(&id)?;
    let (key, conn_res) = tokio::task::spawn_blocking(move || {
        let key = crypto::derive_master_key(&password, &salt);
        let conn_res = (|| -> Result<rusqlite::Connection, rusqlite::Error> {
            let conn = rusqlite::Connection::open(&db_file)?;
            let hex_key: String = key.iter().map(|b| format!("{:02x}", b)).collect();
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))?;
            schema::configure_connection(&conn)?;

            let _verify: i64 =
                conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;
            Ok(conn)
        })();
        (key, conn_res)
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

    // 4. Update state and record attempt
    let mut state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;

    match conn_res {
        Ok(conn) => {
            state_guard.record_attempt(true);
            if state_guard.active_canvas.is_some() {
                return Err(AuthError::CanvasAlreadyActive);
            }
            state_guard.active_canvas = Some(ActiveCanvas { id, db: conn, key });
            Ok(())
        }
        Err(err) => {
            if is_sqlcipher_key_error(&err) {
                state_guard.record_attempt(false);
                Err(AuthError::InvalidPassword)
            } else {
                Err(AuthError::Database(err.to_string()))
            }
        }
    }
}

/// Closes the currently active canvas, clearing it from memory. Idempotent.
pub fn close_canvas_core(state: &Mutex<AppState>) -> Result<(), AuthError> {
    let mut state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    state_guard.active_canvas = None;
    Ok(())
}

/// Renames a canvas in the vault registry.
pub fn rename_canvas_core(
    state: &Mutex<AppState>,
    id: String,
    new_name: String,
) -> Result<(), AuthError> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err(AuthError::Validation("Canvas name cannot be empty".into()));
    }

    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    // Check if canvas exists first
    let current_name: String = vault_conn
        .query_row(
            "SELECT name FROM canvases WHERE id = ?1",
            rusqlite::params![&id],
            |r| r.get(0),
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AuthError::NotFound(format!("Canvas {} not found", id))
            }
            e => AuthError::Database(e.to_string()),
        })?;

    // Check collision against other canvases (excluding this canvas's own current row)
    let name_collides: bool = vault_conn
        .query_row(
            "SELECT 1 FROM canvases WHERE lower(trim(name)) = lower(?1) AND id != ?2",
            rusqlite::params![trimmed, &id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if name_collides {
        return Err(AuthError::NameAlreadyExists);
    }

    // If new name is identical to current name, it succeeds
    if trimmed == current_name {
        return Ok(());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let rows_affected = vault_conn
        .execute(
            "UPDATE canvases SET name = ?1, modified_at = ?2 WHERE id = ?3",
            rusqlite::params![trimmed, &now, &id],
        )
        .map_err(|e| AuthError::Database(e.to_string()))?;

    if rows_affected == 0 {
        return Err(AuthError::NotFound(format!("Canvas {} not found", id)));
    }

    Ok(())
}

/// Disambiguates canvas name collisions in the vault registry.
///
/// If `base_name` does not collide with any existing canvas name (case-insensitive, trimmed),
/// returns `base_name.trim()`.
/// If it collides:
/// - If `base_name` already ends with `" (<suffix>)"`, strips that suffix first to determine the root name.
/// - Tries `"<root> (<suffix>)"`.
/// - If that also collides, tries `"<root> (<suffix> 2)"`, then `"<root> (<suffix> 3)"`, etc.,
///   incrementing until unique.
pub fn resolve_unique_name(
    conn: &rusqlite::Connection,
    base_name: &str,
    suffix: &str,
) -> Result<String, AuthError> {
    let trimmed_base = base_name.trim();
    if trimmed_base.is_empty() {
        return Err(AuthError::Validation("Canvas name cannot be empty".into()));
    }

    let exists = |candidate: &str| -> Result<bool, AuthError> {
        match conn.query_row(
            "SELECT 1 FROM canvases WHERE lower(trim(name)) = lower(?1)",
            rusqlite::params![candidate.trim()],
            |_| Ok(true),
        ) {
            Ok(_) => Ok(true),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(AuthError::Database(e.to_string())),
        }
    };

    // 1. If base_name does not collide, use it unchanged
    if !exists(trimmed_base)? {
        return Ok(trimmed_base.to_string());
    }

    // 2. If it collides, determine root name by stripping existing " (<suffix>)" if present
    let suffix_pattern = format!(" ({})", suffix);
    let root = trimmed_base
        .strip_suffix(&suffix_pattern)
        .unwrap_or(trimmed_base)
        .trim();

    // 3. First collision: "<root> (<suffix>)"
    let first_candidate = format!("{} ({})", root, suffix);
    if !exists(&first_candidate)? {
        return Ok(first_candidate);
    }

    // 4. Subsequent collisions: "<root> (<suffix> 2)", "<root> (<suffix> 3)", ...
    let mut counter = 2;
    loop {
        let candidate = format!("{} ({} {})", root, suffix, counter);
        if !exists(&candidate)? {
            return Ok(candidate);
        }
        counter += 1;
    }
}

/// Duplicates an existing canvas.
///
/// If `new_password` is None or empty:
/// - Copies the canvas db + salt files as-is under a new UUID.
///
/// If `new_password` is Some(non-empty):
/// - Opens the copied DB with the key derived from `original_password`,
///   rekeys it to a new Argon2id key with a fresh salt via `PRAGMA rekey`, and saves the new salt.
pub async fn duplicate_canvas_core(
    state: &Mutex<AppState>,
    id: String,
    original_password: String,
    new_password: Option<String>,
) -> Result<CanvasSummary, AuthError> {
    if original_password.trim().is_empty() {
        return Err(AuthError::Validation("Original password cannot be empty".into()));
    }

    let new_id = uuid::Uuid::new_v4().to_string();

    let (_orig_name, copy_name) = {
        let state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
        let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

        let name: String = vault_conn
            .query_row(
                "SELECT name FROM canvases WHERE id = ?1",
                rusqlite::params![&id],
                |r| r.get(0),
            )
            .map_err(|err| match err {
                rusqlite::Error::QueryReturnedNoRows => {
                    AuthError::NotFound(format!("Canvas {} not found", id))
                }
                e => AuthError::Database(e.to_string()),
            })?;

        let unique_copy = resolve_unique_name(vault_conn, &format!("{} (copy)", name), "copy")?;
        (name, unique_copy)
    };

    let orig_db = paths::canvas_db_path(&id)?;
    let orig_salt = paths::canvas_salt_path(&id)?;
    let new_db = paths::canvas_db_path(&new_id)?;
    let new_salt = paths::canvas_salt_path(&new_id)?;

    match new_password.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => {
            // Byte-for-byte file copy under new UUID
            std::fs::copy(&orig_db, &new_db).map_err(|e| AuthError::Io(e.to_string()))?;
            if let Err(e) = std::fs::copy(&orig_salt, &new_salt) {
                let _ = std::fs::remove_file(&new_db);
                return Err(AuthError::Io(e.to_string()));
            }
        }
        Some(new_pwd) => {
            let orig_salt_bytes =
                std::fs::read(&orig_salt).map_err(|e| AuthError::Io(e.to_string()))?;
            if orig_salt_bytes.len() != crypto::SALT_SIZE {
                return Err(AuthError::Io("Invalid original salt size".into()));
            }
            let mut s = [0u8; crypto::SALT_SIZE];
            s.copy_from_slice(&orig_salt_bytes);
            let old_key = crypto::derive_master_key(&original_password, &s);

            // Copy DB file to new destination
            std::fs::copy(&orig_db, &new_db).map_err(|e| AuthError::Io(e.to_string()))?;

            // Rekey copied DB on worker thread
            let new_pwd_owned = new_pwd.to_string();
            let new_db_owned = new_db.clone();

            let rekey_res = tokio::task::spawn_blocking(move || {
                let conn = rusqlite::Connection::open(&new_db_owned)?;
                let hex_old_key: String = old_key.iter().map(|b| format!("{:02x}", b)).collect();
                conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_old_key))?;
                schema::configure_connection(&conn)?;

                // Verify old key works on copy
                let _verify: i64 =
                    conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;

                // Generate fresh salt and new key
                let fresh_salt = crypto::generate_salt();
                let new_key = crypto::derive_master_key(&new_pwd_owned, &fresh_salt);
                let hex_new_key: String = new_key.iter().map(|b| format!("{:02x}", b)).collect();

                // Rekey SQLCipher database
                conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", hex_new_key))?;

                // Verify rekey was successful
                let _verify2: i64 =
                    conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;

                Ok(fresh_salt)
            })
            .await
            .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

            let fresh_salt = match rekey_res {
                Ok(salt) => salt,
                Err(err) => {
                    let _ = std::fs::remove_file(&new_db);
                    if is_sqlcipher_key_error(&err) {
                        return Err(AuthError::InvalidPassword);
                    }
                    return Err(AuthError::Database(err.to_string()));
                }
            };

            // Write new salt
            if let Err(e) = std::fs::write(&new_salt, fresh_salt) {
                let _ = std::fs::remove_file(&new_db);
                return Err(AuthError::Io(e.to_string()));
            }
        }
    }

    // Insert new registry row in vault
    let now = chrono::Utc::now().to_rfc3339();
    let file_name = format!("{}.db", new_id);
    let summary = CanvasSummary {
        id: new_id.clone(),
        name: copy_name.clone(),
        created_at: now.clone(),
        modified_at: now.clone(),
    };

    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = match state_guard.vault_db.as_ref() {
        Some(conn) => conn,
        None => {
            let _ = std::fs::remove_file(&new_db);
            let _ = std::fs::remove_file(&new_salt);
            return Err(AuthError::NotUnlocked);
        }
    };

    let insert_res = vault_conn.execute(
        "INSERT INTO canvases (id, name, file_name, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![&new_id, &copy_name, &file_name, &now, &now],
    );

    if let Err(e) = insert_res {
        let _ = std::fs::remove_file(&new_db);
        let _ = std::fs::remove_file(&new_salt);
        return Err(AuthError::Database(e.to_string()));
    }

    Ok(summary)
}

/// Deletes a canvas after authenticating its password.
///
/// Deletes disk files first; removes vault registry row last.
pub async fn delete_canvas_core(
    state: &Mutex<AppState>,
    id: String,
    password: String,
) -> Result<(), AuthError> {
    // 1. Check registry and backoff rate-limit
    let delay_to_sleep = {
        let state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
        let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

        let exists: bool = vault_conn
            .query_row(
                "SELECT 1 FROM canvases WHERE id = ?1",
                rusqlite::params![&id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            return Err(AuthError::NotFound(format!("Canvas {} not found", id)));
        }

        match state_guard.check_attempt() {
            Err(BackoffError::RateLimited { wait_remaining }) => {
                return Err(AuthError::RateLimited {
                    wait_remaining_ms: wait_remaining.as_millis() as u64,
                });
            }
            Ok(delay) if delay > Duration::ZERO => Some(delay),
            _ => None,
        }
    };

    if let Some(delay) = delay_to_sleep {
        tokio::time::sleep(delay).await;
    }

    // 2. Read salt
    let salt_file = paths::canvas_salt_path(&id)?;
    let salt_bytes = std::fs::read(&salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
    if salt_bytes.len() != crypto::SALT_SIZE {
        return Err(AuthError::Io("Invalid salt length".into()));
    }
    let mut salt = [0u8; crypto::SALT_SIZE];
    salt.copy_from_slice(&salt_bytes);

    // 3. Verify password against canvas DB on worker thread
    let db_file = paths::canvas_db_path(&id)?;
    let verify_res = tokio::task::spawn_blocking(move || {
        let key = crypto::derive_master_key(&password, &salt);
        let conn = rusqlite::Connection::open(&db_file)?;
        let hex_key: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))?;
        schema::configure_connection(&conn)?;
        let _verify: i64 =
            conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;
        Ok(())
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

    // 4. Record rate-limit outcome and clear active_canvas if this canvas is open
    {
        let mut state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;

        match verify_res {
            Ok(()) => {
                state_guard.record_attempt(true);
                if state_guard.active_canvas.as_ref().map(|c| &c.id) == Some(&id) {
                    state_guard.active_canvas = None;
                }
            }
            Err(err) => {
                if is_sqlcipher_key_error(&err) {
                    state_guard.record_attempt(false);
                    return Err(AuthError::InvalidPassword);
                } else {
                    return Err(AuthError::Database(err.to_string()));
                }
            }
        }
    }

    // 5. Delete disk files first
    let db_file = paths::canvas_db_path(&id)?;
    if db_file.exists() {
        std::fs::remove_file(&db_file).map_err(|e| AuthError::Io(e.to_string()))?;
    }
    if salt_file.exists() {
        std::fs::remove_file(&salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
    }

    // 6. Delete row from vault registry LAST
    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    vault_conn
        .execute(
            "DELETE FROM canvases WHERE id = ?1",
            rusqlite::params![&id],
        )
        .map_err(|e| AuthError::Database(e.to_string()))?;

    Ok(())
}

/// Exports a canvas (name, salt, encrypted db) into a portable bundle file.
pub fn export_canvas_core(
    state: &Mutex<AppState>,
    id: String,
    destination_path: String,
) -> Result<(), AuthError> {
    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let name: String = vault_conn
        .query_row(
            "SELECT name FROM canvases WHERE id = ?1",
            rusqlite::params![&id],
            |r| r.get(0),
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AuthError::NotFound(format!("Canvas {} not found", id))
            }
            e => AuthError::Database(e.to_string()),
        })?;

    let salt_path = paths::canvas_salt_path(&id)?;
    let db_path = paths::canvas_db_path(&id)?;

    let salt_bytes = std::fs::read(&salt_path).map_err(|e| AuthError::Io(e.to_string()))?;
    let db_bytes = std::fs::read(&db_path).map_err(|e| AuthError::Io(e.to_string()))?;

    let bundle_bytes = encode_bundle(&name, &salt_bytes, &db_bytes);

    if let Some(parent) = std::path::Path::new(&destination_path).parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }

    std::fs::write(&destination_path, bundle_bytes).map_err(|e| AuthError::Io(e.to_string()))?;

    Ok(())
}

/// Imports a canvas bundle, writing salt and db files under a new UUID and registering in the vault.
pub fn import_canvas_core(
    state: &Mutex<AppState>,
    source_path: String,
) -> Result<CanvasSummary, AuthError> {
    let bundle_bytes = std::fs::read(&source_path).map_err(|e| AuthError::Io(e.to_string()))?;
    let (name, salt_bytes, db_bytes) = decode_bundle(&bundle_bytes)?;

    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let unique_name = resolve_unique_name(vault_conn, &name, "imported")?;

    let new_id = uuid::Uuid::new_v4().to_string();
    let new_salt_path = paths::canvas_salt_path(&new_id)?;
    let new_db_path = paths::canvas_db_path(&new_id)?;

    // Ensure directory exists
    if let Some(parent) = new_salt_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }

    std::fs::write(&new_salt_path, &salt_bytes).map_err(|e| AuthError::Io(e.to_string()))?;
    if let Err(e) = std::fs::write(&new_db_path, &db_bytes) {
        let _ = std::fs::remove_file(&new_salt_path);
        return Err(AuthError::Io(e.to_string()));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let file_name = format!("{}.db", new_id);

    let insert_res = vault_conn.execute(
        "INSERT INTO canvases (id, name, file_name, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![&new_id, &unique_name, &file_name, &now, &now],
    );

    if let Err(e) = insert_res {
        let _ = std::fs::remove_file(&new_salt_path);
        let _ = std::fs::remove_file(&new_db_path);
        return Err(AuthError::Database(e.to_string()));
    }

    Ok(CanvasSummary {
        id: new_id,
        name: unique_name,
        created_at: now.clone(),
        modified_at: now,
    })
}

/// Changes the password of an existing canvas in-place.
///
/// Rekeys the SQLCipher database with a new Argon2id-derived key and fresh salt,
/// writing the fresh salt atomically via a temporary file.
/// Rejects if the canvas is currently active in `state.active_canvas`.
pub async fn change_canvas_password_core(
    state: &Mutex<AppState>,
    id: String,
    old_password: String,
    new_password: String,
) -> Result<(), AuthError> {
    if old_password.trim().is_empty() {
        return Err(AuthError::Validation("Current password cannot be empty".into()));
    }
    if new_password.trim().is_empty() {
        return Err(AuthError::Validation("New password cannot be empty".into()));
    }

    // 1. Check preconditions and backoff rate-limit
    let delay_to_sleep = {
        let state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;

        let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

        // If active_canvas in AppState matches target id, reject
        if state_guard.active_canvas.as_ref().map(|c| &c.id) == Some(&id) {
            return Err(AuthError::CanvasActiveCannotChangePassword);
        }

        let canvas_exists: bool = vault_conn
            .query_row(
                "SELECT 1 FROM canvases WHERE id = ?1",
                rusqlite::params![&id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !canvas_exists {
            return Err(AuthError::NotFound(format!("Canvas {} not found", id)));
        }

        match state_guard.check_attempt() {
            Err(BackoffError::RateLimited { wait_remaining }) => {
                return Err(AuthError::RateLimited {
                    wait_remaining_ms: wait_remaining.as_millis() as u64,
                });
            }
            Ok(delay) if delay > Duration::ZERO => Some(delay),
            _ => None,
        }
    };

    if let Some(delay) = delay_to_sleep {
        tokio::time::sleep(delay).await;
    }

    // 2. Read canvas salt
    let salt_file = paths::canvas_salt_path(&id)?;
    let salt_bytes = std::fs::read(&salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
    if salt_bytes.len() != crypto::SALT_SIZE {
        return Err(AuthError::Io(format!(
            "Invalid canvas salt file length: expected {}, got {}",
            crypto::SALT_SIZE,
            salt_bytes.len()
        )));
    }
    let mut old_salt = [0u8; crypto::SALT_SIZE];
    old_salt.copy_from_slice(&salt_bytes);

    // 3. Offload Argon2 KDF, old password verification, and PRAGMA rekey to worker thread
    let db_file = paths::canvas_db_path(&id)?;
    let old_pwd_owned = old_password;
    let new_pwd_owned = new_password;

    let rekey_res = tokio::task::spawn_blocking(move || {
        let old_key = crypto::derive_master_key(&old_pwd_owned, &old_salt);
        let new_salt = crypto::generate_salt();
        let new_key = crypto::derive_master_key(&new_pwd_owned, &new_salt);

        let conn = rusqlite::Connection::open(&db_file)?;
        let hex_old_key: String = old_key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_old_key))?;
        schema::configure_connection(&conn)?;

        // Verify old password works
        let _verify: i64 =
            conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;

        // Rekey SQLCipher database
        let hex_new_key: String = new_key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", hex_new_key))?;

        // Verify rekey was successful
        let _verify2: i64 =
            conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;

        Ok(new_salt)
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

    // 4. Check outcome and record rate-limit attempt
    let fresh_salt = {
        let mut state_guard = state
            .lock()
            .map_err(|_| AuthError::Database("Lock poisoned".into()))?;

        match rekey_res {
            Ok(salt) => {
                state_guard.record_attempt(true);
                salt
            }
            Err(err) => {
                if is_sqlcipher_key_error(&err) {
                    state_guard.record_attempt(false);
                    return Err(AuthError::InvalidPassword);
                } else {
                    return Err(AuthError::Database(err.to_string()));
                }
            }
        }
    };

    // 5. Write fresh salt to temporary file first, then atomically rename over real salt file
    let temp_salt_file = paths::canvas_salt_path(&id)?.with_extension("tmp");
    std::fs::write(&temp_salt_file, fresh_salt).map_err(|e| AuthError::Io(e.to_string()))?;
    std::fs::rename(&temp_salt_file, &salt_file).map_err(|e| AuthError::Io(e.to_string()))?;

    // 6. Update modified_at in the vault registry
    let now = chrono::Utc::now().to_rfc3339();
    let state_guard = state
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let vault_conn = state_guard.vault_db.as_ref().ok_or(AuthError::NotUnlocked)?;

    vault_conn
        .execute(
            "UPDATE canvases SET modified_at = ?1 WHERE id = ?2",
            rusqlite::params![&now, &id],
        )
        .map_err(|e| AuthError::Database(e.to_string()))?;

    Ok(())
}

// =========================================================================
// N-API Wrappers
// =========================================================================

use napi_derive::napi;

#[napi]
pub fn cmd_list_canvases() -> napi::Result<Vec<CanvasSummary>> {
    list_canvases_core(&crate::state::GLOBAL_APP_STATE).map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_create_canvas(name: String, password: String) -> napi::Result<CanvasSummary> {
    create_canvas_core(&crate::state::GLOBAL_APP_STATE, name, password)
        .await
        .map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_open_canvas(id: String, password: String) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;
    open_canvas_core(&crate::state::GLOBAL_APP_STATE, id, password)
        .await
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_close_canvas() -> napi::Result<()> {
    close_canvas_core(&crate::state::GLOBAL_APP_STATE).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_rename_canvas(id: String, new_name: String) -> napi::Result<()> {
    rename_canvas_core(&crate::state::GLOBAL_APP_STATE, id, new_name).map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_duplicate_canvas(
    id: String,
    original_password: String,
    new_password: Option<String>,
) -> napi::Result<CanvasSummary> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;
    duplicate_canvas_core(&crate::state::GLOBAL_APP_STATE, id, original_password, new_password)
        .await
        .map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_change_canvas_password(
    id: String,
    old_password: String,
    new_password: String,
) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;
    change_canvas_password_core(&crate::state::GLOBAL_APP_STATE, id, old_password, new_password)
        .await
        .map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_delete_canvas(id: String, password: String) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;
    delete_canvas_core(&crate::state::GLOBAL_APP_STATE, id, password)
        .await
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_export_canvas(id: String, destination_path: String) -> napi::Result<()> {
    export_canvas_core(&crate::state::GLOBAL_APP_STATE, id, destination_path).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_import_canvas(source_path: String) -> napi::Result<CanvasSummary> {
    import_canvas_core(&crate::state::GLOBAL_APP_STATE, source_path).map_err(napi::Error::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use zeroize::Zeroizing;

    static TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    struct TestEnv {
        path: PathBuf,
    }

    impl TestEnv {
        fn new(name: &str) -> Self {
            let unique: String = crypto::generate_salt()
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect();
            let path = std::env::temp_dir().join(format!("lattice_canvas_test_{}_{}", name, unique));
            let _ = std::fs::create_dir_all(&path);
            paths::set_data_dir(path.clone());
            Self { path }
        }

        fn setup_unlocked_state(&self) -> Mutex<AppState> {
            let state = Mutex::new(AppState::new());
            let vault_conn = rusqlite::Connection::open_in_memory().unwrap();
            schema::init_vault_schema(&vault_conn).unwrap();
            {
                let mut s = state.lock().unwrap();
                s.vault_db = Some(vault_conn);
                s.vault_key = Some(Zeroizing::new([42u8; 32]));
            }
            state
        }
    }

    impl Drop for TestEnv {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn test_bundle_encode_decode_roundtrip_and_errors() {
        let name = "Test Canvas";
        let salt = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let db = b"fake-sqlite-encrypted-bytes-12345".to_vec();

        let bundle = encode_bundle(name, &salt, &db);
        assert_eq!(&bundle[0..8], b"LATTICE1");

        let (dec_name, dec_salt, dec_db) = decode_bundle(&bundle).expect("decode succeeded");
        assert_eq!(dec_name, name);
        assert_eq!(dec_salt, salt);
        assert_eq!(dec_db, db);

        // Errors: invalid magic
        let mut bad_magic = bundle.clone();
        bad_magic[0] = b'X';
        assert!(matches!(decode_bundle(&bad_magic), Err(AuthError::InvalidBundle(_))));

        // Errors: too small
        assert!(matches!(decode_bundle(&[0u8; 10]), Err(AuthError::InvalidBundle(_))));

        // Errors: truncated payload
        let truncated = &bundle[..bundle.len() - 5];
        assert!(matches!(decode_bundle(truncated), Err(AuthError::InvalidBundle(_))));
    }

    #[tokio::test]
    async fn test_create_and_list_canvases() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("create_and_list");
        let state = env.setup_unlocked_state();

        // 1. Initially empty
        let initial_list = list_canvases_core(&state).unwrap();
        assert!(initial_list.is_empty());

        // 2. Create canvas
        let created = create_canvas_core(&state, "Main Canvas".into(), "pwd123".into())
            .await
            .expect("create canvas");

        assert_eq!(created.name, "Main Canvas");
        assert!(paths::canvas_db_path(&created.id).unwrap().exists());
        assert!(paths::canvas_salt_path(&created.id).unwrap().exists());

        // 3. List contains newly created canvas
        let list = list_canvases_core(&state).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, created.id);
        assert_eq!(list[0].name, "Main Canvas");

        // 4. Locked vault returns NotUnlocked
        {
            let mut s = state.lock().unwrap();
            s.vault_db = None;
        }
        assert!(matches!(list_canvases_core(&state), Err(AuthError::NotUnlocked)));
        assert!(matches!(
            create_canvas_core(&state, "Other".into(), "pwd".into()).await,
            Err(AuthError::NotUnlocked)
        ));
    }

    #[tokio::test]
    async fn test_open_canvas_correct_password_succeeds() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("open_correct");
        let state = env.setup_unlocked_state();

        let created = create_canvas_core(&state, "My Canvas".into(), "correct-pass".into())
            .await
            .unwrap();

        assert!(state.lock().unwrap().active_canvas.is_none());

        let res = open_canvas_core(&state, created.id.clone(), "correct-pass".into()).await;
        assert!(res.is_ok(), "open_canvas with correct password should succeed");

        let s = state.lock().unwrap();
        assert!(s.active_canvas.is_some());
        let active = s.active_canvas.as_ref().unwrap();
        assert_eq!(active.id, created.id);
        assert_eq!(s.failed_attempts, 0);
    }

    #[tokio::test]
    async fn test_open_canvas_wrong_password_fails() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("open_wrong");
        let state = env.setup_unlocked_state();

        let created = create_canvas_core(&state, "Secure Canvas".into(), "secret".into())
            .await
            .unwrap();

        let res = open_canvas_core(&state, created.id.clone(), "wrong-secret".into()).await;
        assert!(matches!(res, Err(AuthError::InvalidPassword)));

        let s = state.lock().unwrap();
        assert!(s.active_canvas.is_none());
        assert_eq!(s.failed_attempts, 1);
    }

    #[tokio::test]
    async fn test_open_canvas_fails_if_already_active() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("open_already_active");
        let state = env.setup_unlocked_state();

        let c1 = create_canvas_core(&state, "Canvas 1".into(), "pass1".into()).await.unwrap();
        let c2 = create_canvas_core(&state, "Canvas 2".into(), "pass2".into()).await.unwrap();

        open_canvas_core(&state, c1.id.clone(), "pass1".into()).await.unwrap();

        // Attempt to open c2 while c1 is active
        let res = open_canvas_core(&state, c2.id.clone(), "pass2".into()).await;
        assert!(matches!(res, Err(AuthError::CanvasAlreadyActive)));

        // Verify c1 is still the active canvas
        let s = state.lock().unwrap();
        assert_eq!(s.active_canvas.as_ref().map(|c| &c.id), Some(&c1.id));
    }

    #[tokio::test]
    async fn test_close_canvas_clears_active_canvas() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("close_canvas");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Canvas".into(), "pass".into()).await.unwrap();
        open_canvas_core(&state, c.id.clone(), "pass".into()).await.unwrap();

        assert!(state.lock().unwrap().active_canvas.is_some());

        close_canvas_core(&state).unwrap();
        assert!(state.lock().unwrap().active_canvas.is_none());
        assert!(state.lock().unwrap().vault_db.is_some(), "vault should remain unlocked");

        // Idempotent
        assert!(close_canvas_core(&state).is_ok());
    }

    #[tokio::test]
    async fn test_rename_canvas_updates_registry() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("rename_canvas");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Original Name".into(), "pwd".into()).await.unwrap();

        rename_canvas_core(&state, c.id.clone(), "Updated Name".into()).unwrap();

        let list = list_canvases_core(&state).unwrap();
        assert_eq!(list[0].name, "Updated Name");

        // Non-existent canvas
        let res = rename_canvas_core(&state, "non-existent-uuid".into(), "New".into());
        assert!(matches!(res, Err(AuthError::NotFound(_))));

        // Empty name
        let res = rename_canvas_core(&state, c.id.clone(), "  ".into());
        assert!(matches!(res, Err(AuthError::Validation(_))));
    }

    #[tokio::test]
    async fn test_duplicate_without_new_password_is_openable_with_original_password() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("dup_no_new_pwd");
        let state = env.setup_unlocked_state();

        let orig = create_canvas_core(&state, "Project".into(), "orig-pwd".into()).await.unwrap();

        // Empty original password must fail validation
        let empty_res = duplicate_canvas_core(&state, orig.id.clone(), "   ".into(), None).await;
        assert!(matches!(empty_res, Err(AuthError::Validation(_))));

        let dup = duplicate_canvas_core(&state, orig.id.clone(), "orig-pwd".into(), None)
            .await
            .expect("duplicate succeeded");

        assert_ne!(dup.id, orig.id);
        assert_eq!(dup.name, "Project (copy)");
        assert!(paths::canvas_db_path(&dup.id).unwrap().exists());
        assert!(paths::canvas_salt_path(&dup.id).unwrap().exists());

        // Open duplicated canvas with original password
        open_canvas_core(&state, dup.id.clone(), "orig-pwd".into())
            .await
            .expect("open duplicated canvas with orig password succeeds");

        close_canvas_core(&state).unwrap();

        // Open duplicated canvas with wrong password fails
        let res = open_canvas_core(&state, dup.id.clone(), "wrong-pwd".into()).await;
        assert!(matches!(res, Err(AuthError::InvalidPassword)));
    }

    #[tokio::test]
    async fn test_duplicate_with_new_password_rekeys() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("dup_rekey");
        let state = env.setup_unlocked_state();

        let orig = create_canvas_core(&state, "Finance".into(), "old-pwd".into()).await.unwrap();

        // Rekeying with wrong original password must fail
        let wrong_res = duplicate_canvas_core(
            &state,
            orig.id.clone(),
            "wrong-old-pwd".into(),
            Some("new-secure-pwd".into()),
        )
        .await;
        assert!(matches!(wrong_res, Err(AuthError::InvalidPassword)));

        // Duplicate specifying correct original password and new password
        let dup = duplicate_canvas_core(
            &state,
            orig.id.clone(),
            "old-pwd".into(),
            Some("new-secure-pwd".into()),
        )
        .await
        .expect("duplicate with rekey succeeded");

        // 1. Opening duplicated canvas with original password MUST FAIL
        let res_old = open_canvas_core(&state, dup.id.clone(), "old-pwd".into()).await;
        assert!(
            matches!(res_old, Err(AuthError::InvalidPassword)),
            "Original password must fail on rekeyed copy"
        );

        // Reset rate limit for test clarity
        state.lock().unwrap().failed_attempts = 0;

        // 2. Opening duplicated canvas with new password MUST SUCCEED
        let res_new = open_canvas_core(&state, dup.id.clone(), "new-secure-pwd".into()).await;
        assert!(
            res_new.is_ok(),
            "New password must succeed on rekeyed copy"
        );

        close_canvas_core(&state).unwrap();

        // 3. Confirm original canvas is STILL openable with old password
        let res_orig = open_canvas_core(&state, orig.id.clone(), "old-pwd".into()).await;
        assert!(
            res_orig.is_ok(),
            "Original canvas must still open with old password"
        );
    }

    #[tokio::test]
    async fn test_delete_requires_correct_password() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("delete_requires_pwd");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Delete Test".into(), "correct-pass".into()).await.unwrap();

        let res = delete_canvas_core(&state, c.id.clone(), "wrong-pass".into()).await;
        assert!(matches!(res, Err(AuthError::InvalidPassword)));

        // Confirm files and registry row still exist
        assert!(paths::canvas_db_path(&c.id).unwrap().exists());
        assert!(paths::canvas_salt_path(&c.id).unwrap().exists());
        assert_eq!(list_canvases_core(&state).unwrap().len(), 1);
        assert_eq!(state.lock().unwrap().failed_attempts, 1);
    }

    #[tokio::test]
    async fn test_delete_removes_both_files_and_registry_row() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("delete_success");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "To Delete".into(), "correct-pass".into()).await.unwrap();
        open_canvas_core(&state, c.id.clone(), "correct-pass".into()).await.unwrap();

        assert!(state.lock().unwrap().active_canvas.is_some());

        let res = delete_canvas_core(&state, c.id.clone(), "correct-pass".into()).await;
        assert!(res.is_ok());

        // Confirms active_canvas cleared
        assert!(state.lock().unwrap().active_canvas.is_none());

        // Confirms files deleted from disk
        assert!(!paths::canvas_db_path(&c.id).unwrap().exists());
        assert!(!paths::canvas_salt_path(&c.id).unwrap().exists());

        // Confirms registry row deleted
        assert!(list_canvases_core(&state).unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_export_and_import_roundtrip() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("export_import");
        let state = env.setup_unlocked_state();

        let orig = create_canvas_core(&state, "Export Canvas".into(), "roundtrip-key".into())
            .await
            .unwrap();

        // Open and insert a node into the canvas DB to verify contents survive roundtrip
        open_canvas_core(&state, orig.id.clone(), "roundtrip-key".into()).await.unwrap();
        {
            let s = state.lock().unwrap();
            let active = s.active_canvas.as_ref().unwrap();
            active.db.execute(
                "INSERT INTO emails (id, address, provider) VALUES (?1, ?2, ?3)",
                rusqlite::params!["email-1", "user@lattice.local", "Proton"],
            ).unwrap();
        }
        close_canvas_core(&state).unwrap();

        // Export canvas to bundle file
        let bundle_dest = env.path.join("exported_canvas.lattice");
        export_canvas_core(&state, orig.id.clone(), bundle_dest.to_str().unwrap().into())
            .expect("export canvas");

        assert!(bundle_dest.exists());

        // Import canvas from bundle
        let imported = import_canvas_core(&state, bundle_dest.to_str().unwrap().into())
            .expect("import canvas");

        assert_ne!(imported.id, orig.id);
        assert_eq!(imported.name, "Export Canvas (imported)");
        assert!(paths::canvas_db_path(&imported.id).unwrap().exists());
        assert!(paths::canvas_salt_path(&imported.id).unwrap().exists());

        // Open imported canvas with original password
        open_canvas_core(&state, imported.id.clone(), "roundtrip-key".into())
            .await
            .expect("open imported canvas with original password succeeds");

        // Verify the email record survived the export/import bundle roundtrip
        {
            let s = state.lock().unwrap();
            let active = s.active_canvas.as_ref().unwrap();
            let addr: String = active.db.query_row(
                "SELECT address FROM emails WHERE id = ?1",
                rusqlite::params!["email-1"],
                |r| r.get(0),
            ).unwrap();
            assert_eq!(addr, "user@lattice.local");
        }
    }

    #[tokio::test]
    async fn test_import_collision_disambiguation() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("import_collision");
        let state = env.setup_unlocked_state();

        let orig = create_canvas_core(&state, "Notes".into(), "pwd1".into()).await.unwrap();

        let bundle_dest = env.path.join("notes.lattice");
        export_canvas_core(&state, orig.id.clone(), bundle_dest.to_str().unwrap().into()).unwrap();

        // 1st collision -> "Notes (imported)"
        let imp1 = import_canvas_core(&state, bundle_dest.to_str().unwrap().into()).unwrap();
        assert_eq!(imp1.name, "Notes (imported)");

        // 2nd collision -> "Notes (imported 2)"
        let imp2 = import_canvas_core(&state, bundle_dest.to_str().unwrap().into()).unwrap();
        assert_eq!(imp2.name, "Notes (imported 2)");

        // 3rd collision -> "Notes (imported 3)"
        let imp3 = import_canvas_core(&state, bundle_dest.to_str().unwrap().into()).unwrap();
        assert_eq!(imp3.name, "Notes (imported 3)");
    }

    #[tokio::test]
    async fn test_duplicate_collision_disambiguation() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("duplicate_collision");
        let state = env.setup_unlocked_state();

        let orig = create_canvas_core(&state, "Document".into(), "pwd1".into()).await.unwrap();

        // 1st duplication -> "Document (copy)"
        let copy1 = duplicate_canvas_core(&state, orig.id.clone(), "pwd1".into(), None).await.unwrap();
        assert_eq!(copy1.name, "Document (copy)");

        // 2nd duplication of original -> "Document (copy 2)"
        let copy2 = duplicate_canvas_core(&state, orig.id.clone(), "pwd1".into(), None).await.unwrap();
        assert_eq!(copy2.name, "Document (copy 2)");

        // 3rd duplication of original -> "Document (copy 3)"
        let copy3 = duplicate_canvas_core(&state, orig.id.clone(), "pwd1".into(), None).await.unwrap();
        assert_eq!(copy3.name, "Document (copy 3)");
    }

    #[tokio::test]
    async fn test_create_canvas_duplicate_name_rejected() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("create_duplicate_name");
        let state = env.setup_unlocked_state();

        create_canvas_core(&state, "Alpha Plan".into(), "pwd".into()).await.unwrap();

        // Exact match
        let res1 = create_canvas_core(&state, "Alpha Plan".into(), "pwd".into()).await;
        assert!(matches!(res1, Err(AuthError::NameAlreadyExists)));

        // Case-insensitive match
        let res2 = create_canvas_core(&state, "alpha plan".into(), "pwd".into()).await;
        assert!(matches!(res2, Err(AuthError::NameAlreadyExists)));

        // Trimmed match
        let res3 = create_canvas_core(&state, "  ALPHA PLAN  ".into(), "pwd".into()).await;
        assert!(matches!(res3, Err(AuthError::NameAlreadyExists)));

        // Distinct name succeeds
        let res4 = create_canvas_core(&state, "Beta Plan".into(), "pwd".into()).await;
        assert!(res4.is_ok());
    }

    #[tokio::test]
    async fn test_rename_canvas_duplicate_name_rejected_and_self_rename() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("rename_duplicate_name");
        let state = env.setup_unlocked_state();

        let _c1 = create_canvas_core(&state, "First".into(), "pwd".into()).await.unwrap();
        let c2 = create_canvas_core(&state, "Second".into(), "pwd".into()).await.unwrap();

        // Renaming c2 to c1's name (case-insensitive, trimmed) should fail
        let res1 = rename_canvas_core(&state, c2.id.clone(), "first".into());
        assert!(matches!(res1, Err(AuthError::NameAlreadyExists)));

        let res2 = rename_canvas_core(&state, c2.id.clone(), "  First  ".into());
        assert!(matches!(res2, Err(AuthError::NameAlreadyExists)));

        // Self-rename (same name or different casing) should succeed
        assert!(rename_canvas_core(&state, c2.id.clone(), "Second".into()).is_ok());
        assert!(rename_canvas_core(&state, c2.id.clone(), "SECOND".into()).is_ok());

        // Renaming to unused name should succeed
        assert!(rename_canvas_core(&state, c2.id.clone(), "Third".into()).is_ok());
        let list = list_canvases_core(&state).unwrap();
        assert!(list.iter().any(|c| c.name == "Third"));
    }

    #[tokio::test]
    async fn test_change_canvas_password_success() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("change_pwd_success");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Vault Canvas".into(), "old-pwd-123".into()).await.unwrap();

        // Populate some data to verify it survives rekey
        open_canvas_core(&state, c.id.clone(), "old-pwd-123".into()).await.unwrap();
        {
            let s = state.lock().unwrap();
            let active = s.active_canvas.as_ref().unwrap();
            active.db.execute(
                "INSERT INTO emails (id, address, provider) VALUES (?1, ?2, ?3)",
                rusqlite::params!["email-change-pwd", "security@lattice.local", "Proton"],
            ).unwrap();
        }
        close_canvas_core(&state).unwrap();

        let old_modified = c.modified_at.clone();

        // Change password in-place
        change_canvas_password_core(&state, c.id.clone(), "old-pwd-123".into(), "new-pwd-456".into())
            .await
            .expect("password change succeeds");

        // Verify canvas remains closed
        assert!(state.lock().unwrap().active_canvas.is_none());

        // Verify modified_at was updated in registry
        let list = list_canvases_core(&state).unwrap();
        let target = list.iter().find(|x| x.id == c.id).unwrap();
        assert!(target.modified_at >= old_modified);

        // Old password must fail
        let old_open_res = open_canvas_core(&state, c.id.clone(), "old-pwd-123".into()).await;
        assert!(matches!(old_open_res, Err(AuthError::InvalidPassword)));

        // New password must succeed and data must be intact
        open_canvas_core(&state, c.id.clone(), "new-pwd-456".into()).await.unwrap();
        {
            let s = state.lock().unwrap();
            let active = s.active_canvas.as_ref().unwrap();
            let addr: String = active.db.query_row(
                "SELECT address FROM emails WHERE id = ?1",
                rusqlite::params!["email-change-pwd"],
                |r| r.get(0),
            ).unwrap();
            assert_eq!(addr, "security@lattice.local");
        }
    }

    #[tokio::test]
    async fn test_change_canvas_password_wrong_old_password_leaves_db_untouched() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("change_pwd_wrong_old");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Secure Canvas".into(), "correct-old".into()).await.unwrap();

        let salt_before = std::fs::read(paths::canvas_salt_path(&c.id).unwrap()).unwrap();
        let db_before = std::fs::read(paths::canvas_db_path(&c.id).unwrap()).unwrap();

        // Attempt with wrong old password
        let res = change_canvas_password_core(
            &state,
            c.id.clone(),
            "wrong-old".into(),
            "new-password".into(),
        )
        .await;

        assert!(matches!(res, Err(AuthError::InvalidPassword)));

        // Salt and DB files should be untouched
        let salt_after = std::fs::read(paths::canvas_salt_path(&c.id).unwrap()).unwrap();
        let db_after = std::fs::read(paths::canvas_db_path(&c.id).unwrap()).unwrap();
        assert_eq!(salt_before, salt_after);
        assert_eq!(db_before, db_after);

        // New password does NOT work
        let new_open = open_canvas_core(&state, c.id.clone(), "new-password".into()).await;
        assert!(matches!(new_open, Err(AuthError::InvalidPassword)));

        // Original password still works
        assert!(open_canvas_core(&state, c.id.clone(), "correct-old".into()).await.is_ok());
    }

    #[tokio::test]
    async fn test_change_canvas_password_canvas_is_active_rejected() {
        let _lock = TEST_LOCK.lock().await;
        let env = TestEnv::new("change_pwd_active");
        let state = env.setup_unlocked_state();

        let c = create_canvas_core(&state, "Active Canvas".into(), "pass123".into()).await.unwrap();
        open_canvas_core(&state, c.id.clone(), "pass123".into()).await.unwrap();

        // Canvas is currently active in state
        assert!(state.lock().unwrap().active_canvas.is_some());

        let res = change_canvas_password_core(
            &state,
            c.id.clone(),
            "pass123".into(),
            "newpass".into(),
        )
        .await;

        assert!(matches!(res, Err(AuthError::CanvasActiveCannotChangePassword)));

        // Canvas is still active
        assert!(state.lock().unwrap().active_canvas.is_some());
    }
}
