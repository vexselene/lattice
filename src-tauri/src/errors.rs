//! Authentication and system error definitions for Lattice.

#[derive(Debug, thiserror::Error, serde::Serialize, PartialEq, Eq)]
#[serde(tag = "error", content = "details")]
pub enum AuthError {
    #[error("Application is already setup")]
    AlreadySetup,

    #[error("Application is not setup")]
    NotSetup,

    #[error("Application is locked or not unlocked")]
    NotUnlocked,

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Rate limited: please wait {wait_remaining_ms}ms before trying again")]
    RateLimited { wait_remaining_ms: u64 },

    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Filesystem I/O error: {0}")]
    Io(String),

    #[error("Database error: {0}")]
    Database(String),
}

impl From<AuthError> for napi::Error {
    fn from(err: AuthError) -> Self {
        let json_str = serde_json::to_string(&err).unwrap_or_else(|_| format!("{{\"error\":\"{}\"}}", err));
        napi::Error::from_reason(json_str)
    }
}
