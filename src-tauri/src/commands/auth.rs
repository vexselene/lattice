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

/// Core setup logic decoupled from Tauri AppHandle for testability.
pub async fn auth_setup_core(db_file: &Path, salt_file: &Path, password: &str) -> Result<(), AuthError> {
    if db_file.exists() {
        return Err(AuthError::AlreadySetup);
    }

    // Ensure parent directory exists
    if let Some(parent) = db_file.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| AuthError::Io(e.to_string()))?;
        }
    }

    // 1. Generate salt and write to disk
    let salt = crypto::generate_salt();
    std::fs::write(salt_file, salt).map_err(|e| AuthError::Io(e.to_string()))?;

    // 2. Offload CPU-heavy Argon2 KDF + initial DB creation to blocking thread
    let password_owned = password.to_string();
    let db_file_owned = db_file.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();
        let key = crypto::derive_master_key(&password_owned, &salt);
        let duration = start.elapsed();
        eprintln!(
            "[Argon2 KDF] derive_master_key (setup) took {} ms",
            duration.as_millis()
        );

        let conn = rusqlite::Connection::open(&db_file_owned)
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let hex_key: String = key.iter().map(|b| format!("{:02x}", b)).collect();
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex_key))
            .map_err(|e| AuthError::Database(e.to_string()))?;

        schema::configure_connection(&conn).map_err(|e| AuthError::Database(e.to_string()))?;
        schema::create_schema(&conn).map_err(|e| AuthError::Database(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_lock_minutes', '15');",
            [],
        )
        .map_err(|e| AuthError::Database(e.to_string()))?;

        Ok(())
    })
    .await
    .map_err(|e| AuthError::Io(format!("Worker thread join error: {}", e)))?
}

/// Core unlock logic decoupled from Tauri AppHandle for testability.
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

    // 2. Verify database file exists before touching salt file
    if !db_file.exists() {
        return Err(AuthError::NotSetup);
    }

    // 3. Read salt from disk
    let salt_bytes = std::fs::read(salt_file).map_err(|e| AuthError::Io(e.to_string()))?;
    if salt_bytes.len() != crypto::SALT_SIZE {
        return Err(AuthError::Io(format!(
            "Invalid salt file length: expected {}, got {}",
            crypto::SALT_SIZE,
            salt_bytes.len()
        )));
    }
    let mut salt = [0u8; crypto::SALT_SIZE];
    salt.copy_from_slice(&salt_bytes);

    // 4. Offload CPU-heavy Argon2 KDF + SQLCipher connection verification to blocking thread
    let password_owned = password.to_string();
    let db_file_owned = db_file.to_path_buf();

    let (key, conn_res) = tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();
        let key = crypto::derive_master_key(&password_owned, &salt);
        let duration = start.elapsed();
        eprintln!(
            "[Argon2 KDF] derive_master_key (unlock) took {} ms",
            duration.as_millis()
        );

        let conn_res = (|| -> Result<rusqlite::Connection, rusqlite::Error> {
            let conn = rusqlite::Connection::open(&db_file_owned)?;
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

    // 5. Re-acquire state lock and record outcome
    let mut state_guard = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;

    match conn_res {
        Ok(conn) => {
            state_guard.record_attempt(true);
            state_guard.db = Some(conn);
            state_guard.encryption_key = Some(key);
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

static UNLOCK_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

#[napi]
pub async fn cmd_auth_setup(password: String) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;
    let db_file = paths::db_path().map_err(napi::Error::from)?;
    let salt_file = paths::salt_path().map_err(napi::Error::from)?;
    auth_setup_core(&db_file, &salt_file, &password).await.map_err(napi::Error::from)
}

#[napi]
pub async fn cmd_auth_unlock(password: String) -> napi::Result<()> {
    let _gate_lock = crate::state::GLOBAL_UNLOCK_GATE.lock().await;

    let n = UNLOCK_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let enter_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    eprintln!("[unlock #{}] ENTER at {}", n, enter_ts);

    let db_file = paths::db_path().map_err(napi::Error::from)?;
    let salt_file = paths::salt_path().map_err(napi::Error::from)?;
    let res = auth_unlock_core(&db_file, &salt_file, &crate::state::GLOBAL_APP_STATE, &password).await;

    let exit_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let res_label = match &res {
        Ok(_) => "ok".to_string(),
        Err(e) => format!("err({:?})", e),
    };
    eprintln!("[unlock #{}] EXIT at {}, result={}", n, exit_ts, res_label);
    res.map_err(napi::Error::from)
}

#[napi]
pub fn cmd_auth_lock() -> napi::Result<()> {
    let mut state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    state_guard.db = None;
    state_guard.encryption_key = None;
    Ok(())
}

#[napi]
pub fn cmd_auth_status() -> napi::Result<AuthStatus> {
    let db_file = paths::db_path().map_err(napi::Error::from)?;
    let is_setup = db_file.exists();

    let state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let unlocked = state_guard.db.is_some();

    let auto_lock_minutes = if let Some(ref conn) = state_guard.db {
        conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'auto_lock_minutes'",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(15)
    } else {
        15
    };

    Ok(AuthStatus {
        is_setup,
        unlocked,
        auto_lock_minutes,
    })
}

#[napi]
pub fn cmd_update_settings(auto_lock_minutes: i32) -> napi::Result<()> {
    let state_guard = crate::state::GLOBAL_APP_STATE
        .lock()
        .map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = state_guard.db.as_ref().ok_or(AuthError::NotSetup)?;

    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_lock_minutes', ?1);",
        [auto_lock_minutes.to_string()],
    )
    .map_err(|e| AuthError::Database(e.to_string()))?;

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
    async fn test_setup_then_unlock_succeeds() {
        let dir = TestDir::new("setup_unlock");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        // 1. Setup
        let setup_res = auth_setup_core(&db_file, &salt_file, "correct-horse-battery").await;
        assert!(setup_res.is_ok(), "Setup must succeed");
        assert!(db_file.exists(), "DB file created");
        assert!(salt_file.exists(), "Salt file created");

        // AppState is not auto-unlocked by setup
        {
            let s = state.lock().unwrap();
            assert!(s.db.is_none());
            assert!(s.encryption_key.is_none());
        }

        // 2. Unlock
        let unlock_res = auth_unlock_core(&db_file, &salt_file, &state, "correct-horse-battery").await;
        assert!(unlock_res.is_ok(), "Unlock with correct password must succeed");

        // Verify AppState is unlocked
        {
            let s = state.lock().unwrap();
            assert!(s.db.is_some());
            assert!(s.encryption_key.is_some());
            assert_eq!(s.failed_attempts, 0);
        }
    }

    #[tokio::test]
    async fn test_unlock_wrong_password_returns_invalid_password_and_increments_counter() {
        let dir = TestDir::new("wrong_password");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        auth_setup_core(&db_file, &salt_file, "correct-password").await.unwrap();

        let unlock_res = auth_unlock_core(&db_file, &salt_file, &state, "wrong-password").await;
        assert_eq!(unlock_res, Err(AuthError::InvalidPassword));

        let s = state.lock().unwrap();
        assert_eq!(s.failed_attempts, 1);
        assert!(s.db.is_none());
        assert!(s.encryption_key.is_none());
    }

    #[tokio::test]
    async fn test_rate_limiting_after_consecutive_failures() {
        let dir = TestDir::new("rate_limiting");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        auth_setup_core(&db_file, &salt_file, "correct-password").await.unwrap();

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
    async fn test_lock_clears_db_and_encryption_key() {
        let dir = TestDir::new("lock_clears");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        auth_setup_core(&db_file, &salt_file, "correct-password").await.unwrap();
        auth_unlock_core(&db_file, &salt_file, &state, "correct-password").await.unwrap();

        {
            let s = state.lock().unwrap();
            assert!(s.db.is_some());
            assert!(s.encryption_key.is_some());
        }

        // Lock
        {
            let mut s = state.lock().unwrap();
            s.db = None;
            s.encryption_key = None;
        }

        {
            let s = state.lock().unwrap();
            assert!(s.db.is_none());
            assert!(s.encryption_key.is_none());
        }
    }

    #[tokio::test]
    async fn test_status_reporting_all_states() {
        let dir = TestDir::new("status_reporting");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        // State 1: Not setup
        assert!(!db_file.exists());
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(!status.is_setup);
            assert!(!status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }

        // State 2: Setup but locked
        auth_setup_core(&db_file, &salt_file, "password123").await.unwrap();
        assert!(db_file.exists());
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(status.is_setup);
            assert!(!status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }

        // State 3: Unlocked
        auth_unlock_core(&db_file, &salt_file, &state, "password123").await.unwrap();
        {
            let s = state.lock().unwrap();
            let auto_lock = s
                .db
                .as_ref()
                .unwrap()
                .query_row(
                    "SELECT value FROM app_settings WHERE key = 'auto_lock_minutes'",
                    [],
                    |r| r.get::<_, String>(0),
                )
                .unwrap()
                .parse::<i32>()
                .unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.db.is_some(),
                auto_lock_minutes: auto_lock,
            };
            assert!(status.is_setup);
            assert!(status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }

        // State 4: Locked again after unlock
        {
            let mut s = state.lock().unwrap();
            s.db = None;
            s.encryption_key = None;
        }
        {
            let s = state.lock().unwrap();
            let status = AuthStatus {
                is_setup: db_file.exists(),
                unlocked: s.db.is_some(),
                auto_lock_minutes: 15,
            };
            assert!(status.is_setup);
            assert!(!status.unlocked);
            assert_eq!(status.auto_lock_minutes, 15);
        }
    }

    #[tokio::test]
    async fn test_update_settings_succeeds_when_unlocked_and_fails_when_locked() {
        let dir = TestDir::new("update_settings");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());

        // 1. Updating settings while locked returns NotSetup
        {
            let s = state.lock().unwrap();
            let res = s.db.as_ref().ok_or(AuthError::NotSetup);
            assert_eq!(res.err(), Some(AuthError::NotSetup));
        }

        // 2. Setup and unlock
        auth_setup_core(&db_file, &salt_file, "pass").await.unwrap();
        auth_unlock_core(&db_file, &salt_file, &state, "pass").await.unwrap();

        // 3. Update settings to 30 minutes
        {
            let s = state.lock().unwrap();
            let conn = s.db.as_ref().unwrap();
            conn.execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('auto_lock_minutes', ?1);",
                ["30"],
            )
            .unwrap();
        }

        // 4. Verify updated value in DB
        {
            let s = state.lock().unwrap();
            let updated: String = s
                .db
                .as_ref()
                .unwrap()
                .query_row(
                    "SELECT value FROM app_settings WHERE key = 'auto_lock_minutes'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(updated, "30");
        }
    }

    #[tokio::test]
    async fn test_unlock_gate_serializes_concurrent_attempts_and_rate_limits() {
        let dir = TestDir::new("concurrency_serialized");
        let db_file = dir.path().join("lattice.db");
        let salt_file = dir.path().join("lattice.salt");
        let state = Mutex::new(AppState::new());
        let gate = tokio::sync::Mutex::new(());

        auth_setup_core(&db_file, &salt_file, "correct-password").await.unwrap();

        eprintln!("=== LAUNCHING 5 GATED CONCURRENT UNLOCK CALLS ===");
        let run_attempt = |id: usize, pwd: &'static str| {
            let db = db_file.clone();
            let salt = salt_file.clone();
            let s = &state;
            let g = &gate;
            async move {
                let _lock = g.lock().await;
                let enter_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
                eprintln!("[gated-unlock #{}] ENTER at {}", id, enter_ts);
                let r = auth_unlock_core(&db, &salt, s, pwd).await;
                let exit_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
                eprintln!("[gated-unlock #{}] EXIT at {}, result={:?}", id, exit_ts, r);
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

        eprintln!("Final gated outcomes: r1={:?}, r2={:?}, r3={:?}, r4={:?}, r5={:?}", r1, r2, r3, r4, r5);
        assert_eq!(r1, Err(AuthError::InvalidPassword));
        assert_eq!(r2, Err(AuthError::InvalidPassword));
        assert_eq!(r3, Err(AuthError::InvalidPassword));
        assert!(matches!(r4, Err(AuthError::RateLimited { .. })));
        assert!(matches!(r5, Err(AuthError::RateLimited { .. })));
    }
}
