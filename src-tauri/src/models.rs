//! Data models for Lattice entities, mirroring database tables.

use serde::{Deserialize, Serialize};

/// Helper to deserialize a JSON-encoded string column into `Vec<String>`.
pub fn parse_tags(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// Helper to serialize a `Vec<String>` slice into a JSON-encoded string for SQLite.
pub fn serialize_tags(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EmailNode {
    pub id: String,
    pub address: String,
    pub provider: Option<String>,
    pub password_encrypted: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhoneNode {
    pub id: String,
    pub number: String,
    pub carrier: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServiceNode {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
    pub category: Option<String>,
    pub icon_url: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AccountNode {
    pub id: String,
    pub username: String,
    pub password_encrypted: Option<String>,
    pub service_id: String,
    pub primary_email_id: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Edge {
    pub id: String,
    #[napi(js_name = "source_type")]
    pub source_type: String,
    #[napi(js_name = "source_id")]
    pub source_id: String,
    #[napi(js_name = "target_type")]
    pub target_type: String,
    #[napi(js_name = "target_id")]
    pub target_id: String,
    pub relation: String,
    pub notes: Option<String>,
    #[napi(js_name = "created_at")]
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value: String,
}

use napi_derive::napi;

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthStatus {
    pub is_setup: bool,
    pub unlocked: bool,
    pub auto_lock_minutes: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    Email,
    Phone,
    Service,
    Account,
}

impl NodeType {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "email" | "emails" => Ok(NodeType::Email),
            "phone" | "phones" => Ok(NodeType::Phone),
            "service" | "services" => Ok(NodeType::Service),
            "account" | "accounts" => Ok(NodeType::Account),
            other => Err(format!("Invalid node type: '{}'", other)),
        }
    }

    pub fn table_name(&self) -> &'static str {
        match self {
            NodeType::Email => "emails",
            NodeType::Phone => "phones",
            NodeType::Service => "services",
            NodeType::Account => "accounts",
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            NodeType::Email => "email",
            NodeType::Phone => "phone",
            NodeType::Service => "service",
            NodeType::Account => "account",
        }
    }
}

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphNode {
    #[napi(js_name = "type")]
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: serde_json::Value,
}

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<Edge>,
}

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EdgeCreatePayload {
    #[napi(js_name = "source_type")]
    pub source_type: String,
    #[napi(js_name = "source_id")]
    pub source_id: String,
    #[napi(js_name = "target_type")]
    pub target_type: String,
    #[napi(js_name = "target_id")]
    pub target_id: String,
    pub relation: String,
    pub notes: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EdgeUpdatePayload {
    pub relation: Option<String>,
    pub notes: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tags_serialization_roundtrip() {
        let tags = vec!["primary".to_string(), "work".to_string()];
        let json_str = serialize_tags(&tags);
        assert_eq!(json_str, "[\"primary\",\"work\"]");

        let parsed = parse_tags(&json_str);
        assert_eq!(parsed, tags);

        // Fallback on invalid JSON
        assert_eq!(parse_tags("invalid"), Vec::<String>::new());
    }

    #[test]
    fn test_model_serde_roundtrip() {
        let email = EmailNode {
            id: "uuid-1".to_string(),
            address: "test@example.com".to_string(),
            provider: Some("ProtonMail".to_string()),
            password_encrypted: None,
            notes: Some("Personal".to_string()),
            tags: vec!["tag1".to_string()],
            position_x: 100.5,
            position_y: 200.25,
            created_at: "2026-09-03T12:00:00Z".to_string(),
            updated_at: "2026-09-03T12:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&email).unwrap();
        let deserialized: EmailNode = serde_json::from_str(&json).unwrap();
        assert_eq!(email, deserialized);
    }
}
