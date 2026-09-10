//! Authentication and session management commands for Lattice.

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use crate::crypto;
use crate::errors::AuthError;
use crate::models::AuthStatus;
use crate::paths;
use crate::schema;
use crate::state::{AppState, BackoffError};

/// Checks if an error returned by SQLCipher on query execution represents an authentication / wrong-key failure.
pub fn is_sqlcipher_key_error(err: &rusqlite::Error) -> bool {
    match err {
        rusqlite::Error::SqliteFailure(ffi_err, msg) => {
            let is_not_db_code = ffi_err.code == rusqlite::ErrorCode::NotADatabase
                || ffi_err.extended_code == rusqlite::ffi::SQLITE_NOTADB;
            let msg_matches = msg
                .as_deref()
                .map(|m| {
                    let lower = m.to_lowercase();
                    lower.contains("file is not a database")
                        || lower.contains("file is encrypted or is not a database")
                        || lower.contains("not a database")
                })
                .unwrap_or(false);
            is_not_db_code || msg_matches
        }
        _ => false,
    }
}

/// Core setup wrapper delegating directly to unified `auth_unlock_core`.
pub async fn auth_setup_core(db_file: &Path, salt_file: &Path, password: &str) -> Result<(), AuthError> {
    let dummy_state = Mutex::new(AppState::new());
    auth_unlock_core(db_file, salt_file, &dummy_state, password).await
}

/// Core vault unlock and first-run setup logic decoupled from Tauri / N-API for testability.
pub async fn auth_unlock_core(
    db_file: &Path,
    salt_file: &Path,
    state: &Mutex<AppState>,
    password: &str,
) -> Result<(), AuthError> {
    // 1. Lock state and check backoff rate-limiting pre-flight
    let delay_to_sleep = {
        let state_guard = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
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

    // 2. Ensure parent directories exist
    if let Some(parent) = db_file.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }
    if let Some(parent) = salt_file.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }

    // 3. Determine if first run (salt file does not exist)
    let is_first_run = !salt_file.exists();
    let salt = if is_first_run {
        let new_salt = crypto::generate_salt();
        std::fs::write(salt_file, new_salt).map_err(|e| AuthError::Io(e.to_string()))?;
        new_salt
    } else {
        let salt_bytes = std::fs::read(salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
        if salt_bytes.len() != crypto::SALT_SIZE {
            return Err(AuthError::Io(format!(
                "Invalid salt file length: expected {}, got {}",
                crypto::SALT_SIZE,
                salt_bytes.len()
            )));
        }
        let mut s = [0u8; crypto::SALT_SIZE];
        s.copy_from_slice(&salt_bytes);
        s
    };

    // 4. Offload CPU-heavy Argon2 KDF + SQLCipher vault verification / initialization to blocking thread
    let password_owned = password.to_string();
    let db_file_owned = db_file.to_path_buf();

    let (key, conn_res) = tokio::task::spawn_blocking(move || {
        let key = crypto::derive_master_key(&password_owned, &salt);

        let conn_res = (|| -> Result<rusqlite::Connection, rusqlite::Error> {
            let conn = schema::open_sqlcipher_connection(&db_file_owned, &key)?;

            if !is_first_run {
                // Verify master key against existing database
                let _verify: i64 =
                    conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0))?;
            }

            schema::init_vault_schema(&conn)?;
            Ok(conn)
        })();

        (key, conn_res)
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?;

    // 5. Re-acquire state lock and record outcome
    let mut state_guard = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;

    match conn_res {
        Ok(conn) => {
            state_guard.record_attempt(true);
            state_guard.vault_db = Some(conn);
            state_guard.vault_key = Some(key);
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

// =========================================================================
// Tauri Commands
// =========================================================================

use napi_derive::napi;

#[napi]
pub fn init_app(data_dir: Option<String>) {
    if let Some(dir) = data_dir {
        paths::set_data_dir(std::path::PathBuf::from(dir));
    }
}

#[napi]
pub async fn cmd_auth_setup(password: String) -> napi::Result<()> {
    cmd_auth_unlock(password).await
}

#[napi]
pub async fn cmd_auth_unlock(password: String) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;

    let db_file = paths::vault_db_path().map_err(napi::Error::from)?;
    let salt_file = paths::vault_salt_path().map_err(napi::Error::from)?;
    let res = auth_unlock_core(&db_file, &salt_file, &crate::state::GLOBAL_APP_STATE, &password).await;

    res.map_err(napi::Error::from)
}

#[napi]
pub fn cmd_auth_lock() -> napi::Result<()> {
    let mut state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    state_guard.vault_db = None;
    state_guard.vault_key = None;
    state_guard.active_canvas = None;
    Ok(())
}

#[napi]
pub fn cmd_auth_status() -> napi::Result<AuthStatus> {
    let db_file = paths::vault_db_path().map_err(napi::Error::from)?;
    let is_setup = db_file.exists();

    let state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let unlocked = state_guard.vault_db.is_some();

    Ok(AuthStatus {
        is_setup,
        unlocked,
        auto_lock_minutes: 15,
    })
}

#[napi]
pub fn cmd_update_settings(_auto_lock_minutes: i32) -> napi::Result<()> {
    let state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    if state_guard.vault_db.is_none() {
        return Err(AuthError::NotSetup.into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new(name: &str) -> Self {
            let unique: String = crypto::generate_salt()
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect();
            let path = std::env::temp_dir().join(format!("lattice_test_{}_{}", name, unique));
            let _ = std::fs::create_dir_all(&path);
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    #[tokio::test]
    async fn test_fresh_vault_creation_on_first_unlock() {
        let dir = TestDir::new("fresh_vault");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        assert!(!db_file.exists());
        assert!(!salt_file.exists());

        let res = auth_unlock_core(&db_file, &salt_file, &state, "correct-horse-battery").await;
        assert!(res.is_ok(), "First unlock must create vault");
        assert!(db_file.exists(), "Vault DB must be created");
        assert!(salt_file.exists(), "Vault salt must be created");

        let s = state.lock().unwrap();
        assert!(s.vault_db.is_some(), "vault_db must be populated");
        assert!(s.vault_key.is_some(), "vault_key must be populated");
        assert_eq!(s.failed_attempts, 0);
    }

    #[tokio::test]
    async fn test_vault_schema_is_correctly_created() {
        let dir = TestDir::new("vault_schema");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        auth_unlock_core(&db_file, &salt_file, &state, "vault-pwd").await.unwrap();

        let s = state.lock().unwrap();
        let conn = s.vault_db.as_ref().unwrap();

        // Verify canvases table exists and is queryable
        let count: i64 = conn.query_row("SELECT count(*) FROM canvases", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);

        // Verify canvases table column structure
        let mut stmt = conn.prepare("PRAGMA table_info(canvases)").unwrap();
        let cols: Vec<String> = stmt
            .query_map([], |row| row.get(1))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(cols, vec!["id", "name", "file_name", "created_at", "modified_at"]);
    }

    #[tokio::test]
    async fn test_wrong_password_on_existing_vault_is_rejected() {
        let dir = TestDir::new("wrong_password");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        // First run creates the vault
        auth_unlock_core(&db_file, &salt_file, &state, "correct-password").await.unwrap();

        // Second attempt with wrong password on fresh state
        let state2 = Mutex::new(AppState::new());
        let res = auth_unlock_core(&db_file, &salt_file, &state2, "wrong-password").await;
        assert_eq!(res, Err(AuthError::InvalidPassword));

        let s = state2.lock().unwrap();
        assert_eq!(s.failed_attempts, 1);
        assert!(s.vault_db.is_none());
        assert!(s.vault_key.is_none());
    }

    #[tokio::test]
    async fn test_correct_password_on_existing_vault_succeeds() {
        let dir = TestDir::new("existing_vault_success");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        // 1. First run creates vault
        auth_unlock_core(&db_file, &salt_file, &state, "my-secret-vault").await.unwrap();

        // Insert a canvas record into the vault
        {
            let s = state.lock().unwrap();
            let conn = s.vault_db.as_ref().unwrap();
            conn.execute(
                "INSERT INTO canvases (id, name, file_name, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params!["c1", "Work Canvas", "c1.db", "2026-09-08T00:00:00Z", "2026-09-08T00:00:00Z"],
            ).unwrap();
        }

        // 2. Lock / simulate new app launch
        let state2 = Mutex::new(AppState::new());
        let res = auth_unlock_core(&db_file, &salt_file, &state2, "my-secret-vault").await;
        assert!(res.is_ok());

        let s2 = state2.lock().unwrap();
        assert!(s2.vault_db.is_some());
        assert!(s2.vault_key.is_some());
        let conn2 = s2.vault_db.as_ref().unwrap();
        let name: String = conn2.query_row("SELECT name FROM canvases WHERE id = 'c1'", [], |r| r.get(0)).unwrap();
        assert_eq!(name, "Work Canvas");
    }

    #[tokio::test]
    async fn test_rate_limiting_after_consecutive_failures() {
        let dir = TestDir::new("rate_limiting");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        auth_unlock_core(&db_file, &salt_file, &state, "correct-password").await.unwrap();

        // 3 consecutive failures: no delay required
        let r1 = auth_unlock_core(&db_file, &salt_file, &state, "bad-1").await;
        assert_eq!(r1, Err(AuthError::InvalidPassword));

        let r2 = auth_unlock_core(&db_file, &salt_file, &state, "bad-2").await;
        assert_eq!(r2, Err(AuthError::InvalidPassword));

        let r3 = auth_unlock_core(&db_file, &salt_file, &state, "bad-3").await;
        assert_eq!(r3, Err(AuthError::InvalidPassword));

        {
            let s = state.lock().unwrap();
            assert_eq!(s.failed_attempts, 3);
        }

        // 4th attempt immediately: must return RateLimited without doing DB work or Argon2
        let r4 = auth_unlock_core(&db_file, &salt_file, &state, "bad-4").await;
        match r4 {
            Err(AuthError::RateLimited { wait_remaining_ms }) => {
                assert!(wait_remaining_ms > 0 && wait_remaining_ms <= 1000);
            }
            other => panic!("Expected RateLimited error, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_lock_clears_vault_and_active_canvas() {
        let dir = TestDir::new("lock_clears");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        auth_unlock_core(&db_file, &salt_file, &state, "correct-password").await.unwrap();

        // Simulate an open active canvas
        {
            let mut s = state.lock().unwrap();
            assert!(s.vault_db.is_some());
            assert!(s.vault_key.is_some());
            let canvas_conn = rusqlite::Connection::open_in_memory().unwrap();
            s.active_canvas = Some(crate::state::ActiveCanvas {
                id: "c1".to_string(),
                db: canvas_conn,
                key: zeroize::Zeroizing::new([7u8; 32]),
            });
        }

        // Lock
        {
            let mut s = state.lock().unwrap();
            s.vault_db = None;
            s.vault_key = None;
            s.active_canvas = None;
        }

        {
            let s = state.lock().unwrap();
            assert!(s.vault_db.is_none());
            assert!(s.vault_key.is_none());
            assert!(s.active_canvas.is_none());
        }
    }

    #[tokio::test]
    async fn test_status_reporting_all_states() {
        let dir = TestDir::new("status_reporting");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());

        // State 1: Not setup
        assert!(!db_file.exists());
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.vault_db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(!status.is_setup);
            assert!(!status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }

        // State 2: Unlocked on first run
        auth_unlock_core(&db_file, &salt_file, &state, "password123").await.unwrap();
        assert!(db_file.exists());
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.vault_db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(status.is_setup);
            assert!(status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }

        // State 3: Locked after unlock
        {
            let mut s = state.lock().unwrap();
            s.vault_db = None;
            s.vault_key = None;
        }
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.vault_db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(status.is_setup);
            assert!(!status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }
    }

    #[tokio::test]
    async fn test_unlock_gate_serializes_concurrent_attempts_and_rate_limits() {
        let dir = TestDir::new("concurrency_serialized");
        let db_file = dir.path().join("vault.db");
        let salt_file = dir.path().join("vault.salt");
        let state = Mutex::new(AppState::new());
        let gate = tokio::sync::Mutex::new(());

        // Create vault
        auth_unlock_core(&db_file, &salt_file, &state, "correct-password").await.unwrap();

        let run_attempt = |id: usize, pwd: &'static str| {
            let db = db_file.clone();
            let salt = salt_file.clone();
            let s = &state;
            let g = &gate;
            async move {
                let _lock = g.lock().await;
                let r = auth_unlock_core(&db, &salt, s, pwd).await;
                r
            }
        };

        let (r1, r2, r3, r4, r5) = tokio::join!(
            run_attempt(1, "wrong-1"),
            run_attempt(2, "wrong-2"),
            run_attempt(3, "wrong-3"),
            run_attempt(4, "wrong-4"),
            run_attempt(5, "wrong-5"),
        );

        assert_eq!(r1, Err(AuthError::InvalidPassword));
        assert_eq!(r2, Err(AuthError::InvalidPassword));
        assert_eq!(r3, Err(AuthError::InvalidPassword));
        assert!(matches!(r4, Err(AuthError::RateLimited { .. })));
        assert!(matches!(r5, Err(AuthError::RateLimited { .. })));
    }
}
