//! SQLite / SQLCipher Database Schema Definition for Lattice

pub const INIT_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS emails (
    id                 TEXT PRIMARY KEY,
    address            TEXT NOT NULL UNIQUE,
    provider           TEXT,
    password_encrypted TEXT,
    notes              TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    position_x         REAL NOT NULL DEFAULT 0.0,
    position_y         REAL NOT NULL DEFAULT 0.0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_emails_address ON emails(address);

CREATE TABLE IF NOT EXISTS phones (
    id                 TEXT PRIMARY KEY,
    number             TEXT NOT NULL UNIQUE,
    carrier            TEXT,
    notes              TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    position_x         REAL NOT NULL DEFAULT 0.0,
    position_y         REAL NOT NULL DEFAULT 0.0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_phones_number ON phones(number);

CREATE TABLE IF NOT EXISTS services (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    color              TEXT NOT NULL DEFAULT '',
    url                TEXT,
    category           TEXT,
    icon_url           TEXT,
    notes              TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    position_x         REAL NOT NULL DEFAULT 0.0,
    position_y         REAL NOT NULL DEFAULT 0.0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);

CREATE TABLE IF NOT EXISTS accounts (
    id                 TEXT PRIMARY KEY,
    username           TEXT NOT NULL,
    password_encrypted TEXT,
    service_id         TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    primary_email_id   TEXT REFERENCES emails(id) ON DELETE SET NULL,
    notes              TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    position_x         REAL NOT NULL DEFAULT 0.0,
    position_y         REAL NOT NULL DEFAULT 0.0,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_service ON accounts(service_id);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(primary_email_id);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

CREATE TABLE IF NOT EXISTS edges (
    id          TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('email','account','service','phone')),
    source_id   TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('email','account','service','phone')),
    target_id   TEXT NOT NULL,
    relation    TEXT NOT NULL CHECK (relation IN ('registered_with','recovery_for','uses_username','linked_account')),
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);

CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('auto_lock_minutes', '15');
"#;

/// Configures an opened SQLite / SQLCipher connection with required runtime pragmas.
///
/// MUST be called unconditionally on every connection immediately upon opening to ensure
/// that foreign key constraints and cascaded actions (`ON DELETE CASCADE`, `ON DELETE SET NULL`)
/// are actively enforced by the SQLite engine for the lifetime of the connection.
pub fn configure_connection(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
}

/// Initializes the complete schema on a newly opened or unlocked SQLite / SQLCipher connection.
pub fn create_schema(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    configure_connection(conn)?;
    conn.execute_batch(INIT_SQL)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_create_schema_in_memory() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        create_schema(&conn).expect("create schema succeeded");

        // Verify tables exist
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(tables.contains(&"emails".to_string()));
        assert!(tables.contains(&"phones".to_string()));
        assert!(tables.contains(&"services".to_string()));
        assert!(tables.contains(&"accounts".to_string()));
        assert!(tables.contains(&"edges".to_string()));
        assert!(tables.contains(&"app_settings".to_string()));

        // Verify default settings row
        let auto_lock: String = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'auto_lock_minutes'",
                [],
                |row| row.get(0),
            )
            .expect("auto_lock_minutes row exists");
        assert_eq!(auto_lock, "15");
    }

    #[test]
    fn test_foreign_key_cascade_service_delete() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        configure_connection(&conn).expect("configure connection with FKs");
        create_schema(&conn).expect("create schema");

        // 1. Insert service
        conn.execute(
            "INSERT INTO services (id, name) VALUES (?1, ?2)",
            ["srv-1", "GitHub"],
        )
        .expect("insert service");

        // 2. Insert account referencing service
        conn.execute(
            "INSERT INTO accounts (id, username, service_id) VALUES (?1, ?2, ?3)",
            ["acc-1", "octocat", "srv-1"],
        )
        .expect("insert account");

        // Verify account exists
        let acc_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM accounts WHERE id = 'acc-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(acc_count, 1);

        // 3. Delete service
        conn.execute("DELETE FROM services WHERE id = 'srv-1'", [])
            .expect("delete service");

        // 4. Assert account is cascaded (deleted)
        let acc_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM accounts WHERE id = 'acc-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(acc_after, 0, "Account row must be cascaded on service delete");
    }

    #[test]
    fn test_foreign_key_set_null_email_delete() {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        configure_connection(&conn).expect("configure connection with FKs");
        create_schema(&conn).expect("create schema");

        // 1. Insert service and email
        conn.execute(
            "INSERT INTO services (id, name) VALUES (?1, ?2)",
            ["srv-1", "GitLab"],
        )
        .expect("insert service");

        conn.execute(
            "INSERT INTO emails (id, address) VALUES (?1, ?2)",
            ["em-1", "dev@example.com"],
        )
        .expect("insert email");

        // 2. Insert account referencing both service and email
        conn.execute(
            "INSERT INTO accounts (id, username, service_id, primary_email_id) VALUES (?1, ?2, ?3, ?4)",
            ["acc-2", "gitlab_user", "srv-1", "em-1"],
        )
        .expect("insert account");

        // Verify email reference is populated
        let email_id: Option<String> = conn
            .query_row(
                "SELECT primary_email_id FROM accounts WHERE id = 'acc-2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(email_id, Some("em-1".to_string()));

        // 3. Delete email
        conn.execute("DELETE FROM emails WHERE id = 'em-1'", [])
            .expect("delete email");

        // 4. Assert referencing account still exists but primary_email_id became NULL
        let (acc_exists, email_after): (i64, Option<String>) = conn
            .query_row(
                "SELECT COUNT(*), primary_email_id FROM accounts WHERE id = 'acc-2'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(acc_exists, 1, "Account row should still exist");
        assert_eq!(email_after, None, "primary_email_id must be SET NULL on email delete");
    }
}
