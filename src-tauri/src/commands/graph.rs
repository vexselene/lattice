//! Graph, Node, Edge, and Search commands for Lattice.

use std::sync::Mutex;
use rusqlite::Connection;
use crate::crypto;
use crate::errors::AuthError;
use crate::models::{
    parse_tags, serialize_tags, Edge, EdgeCreatePayload, EdgeUpdatePayload, GraphData, GraphNode,
    NodeType,
};
use crate::state::AppState;

fn decrypt_notes(key: &[u8; 32], ciphertext: Option<String>) -> Option<String> {
    match ciphertext {
        Some(ct) if !ct.trim().is_empty() => crypto::decrypt_field(&ct, key).ok(),
        _ => None,
    }
}

fn encrypt_notes(key: &[u8; 32], notes: Option<&str>) -> Result<Option<String>, AuthError> {
    match notes {
        Some(n) if !n.trim().is_empty() => {
            crypto::encrypt_field(n, key).map(Some).map_err(|e| AuthError::Database(e.to_string()))
        }
        _ => Ok(None),
    }
}

fn encrypt_password(key: &[u8; 32], password: Option<&str>) -> Result<Option<String>, AuthError> {
    match password {
        Some(p) if !p.is_empty() => {
            crypto::encrypt_field(p, key).map(Some).map_err(|e| AuthError::Database(e.to_string()))
        }
        _ => Ok(None),
    }
}

// =========================================================================
// Core Business Logic
// =========================================================================

pub fn get_graph_core(state: &Mutex<AppState>) -> Result<GraphData, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    let mut nodes = Vec::new();

    // 1. Emails
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, address, provider, notes, tags, position_x, position_y, created_at, updated_at FROM emails",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, f64>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                ))
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            let (id, address, provider, notes_cipher, tags_str, px, py, created_at, updated_at) =
                r.map_err(|e| AuthError::Database(e.to_string()))?;
            let notes_plain = decrypt_notes(key, notes_cipher);
            let tags = parse_tags(&tags_str);
            nodes.push(GraphNode {
                node_type: "email".to_string(),
                data: serde_json::json!({
                    "id": id,
                    "address": address,
                    "provider": provider,
                    "notes": notes_plain,
                    "tags": tags,
                    "position_x": px,
                    "position_y": py,
                    "created_at": created_at,
                    "updated_at": updated_at,
                }),
            });
        }
    }

    // 2. Phones
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, number, carrier, notes, tags, position_x, position_y, created_at, updated_at FROM phones",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, f64>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                ))
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            let (id, number, carrier, notes_cipher, tags_str, px, py, created_at, updated_at) =
                r.map_err(|e| AuthError::Database(e.to_string()))?;
            let notes_plain = decrypt_notes(key, notes_cipher);
            let tags = parse_tags(&tags_str);
            nodes.push(GraphNode {
                node_type: "phone".to_string(),
                data: serde_json::json!({
                    "id": id,
                    "number": number,
                    "carrier": carrier,
                    "notes": notes_plain,
                    "tags": tags,
                    "position_x": px,
                    "position_y": py,
                    "created_at": created_at,
                    "updated_at": updated_at,
                }),
            });
        }
    }

    // 3. Services
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, url, category, icon_url, notes, tags, position_x, position_y, created_at, updated_at FROM services",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, f64>(7)?,
                    row.get::<_, f64>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                ))
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            let (id, name, url, category, icon_url, notes_cipher, tags_str, px, py, created_at, updated_at) =
                r.map_err(|e| AuthError::Database(e.to_string()))?;
            let notes_plain = decrypt_notes(key, notes_cipher);
            let tags = parse_tags(&tags_str);
            nodes.push(GraphNode {
                node_type: "service".to_string(),
                data: serde_json::json!({
                    "id": id,
                    "name": name,
                    "url": url,
                    "category": category,
                    "icon_url": icon_url,
                    "notes": notes_plain,
                    "tags": tags,
                    "position_x": px,
                    "position_y": py,
                    "created_at": created_at,
                    "updated_at": updated_at,
                }),
            });
        }
    }

    // 4. Accounts
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, username, service_id, primary_email_id, notes, tags, position_x, position_y, created_at, updated_at FROM accounts",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, f64>(6)?,
                    row.get::<_, f64>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                ))
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            let (id, username, service_id, primary_email_id, notes_cipher, tags_str, px, py, created_at, updated_at) =
                r.map_err(|e| AuthError::Database(e.to_string()))?;
            let notes_plain = decrypt_notes(key, notes_cipher);
            let tags = parse_tags(&tags_str);
            nodes.push(GraphNode {
                node_type: "account".to_string(),
                data: serde_json::json!({
                    "id": id,
                    "username": username,
                    "service_id": service_id,
                    "primary_email_id": primary_email_id,
                    "notes": notes_plain,
                    "tags": tags,
                    "position_x": px,
                    "position_y": py,
                    "created_at": created_at,
                    "updated_at": updated_at,
                }),
            });
        }
    }

    // 5. Edges
    let mut edges = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, source_type, source_id, target_type, target_id, relation, notes, created_at FROM edges",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Edge {
                    id: row.get(0)?,
                    source_type: row.get(1)?,
                    source_id: row.get(2)?,
                    target_type: row.get(3)?,
                    target_id: row.get(4)?,
                    relation: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            edges.push(r.map_err(|e| AuthError::Database(e.to_string()))?);
        }
    }

    Ok(GraphData { nodes, edges })
}

pub fn get_nodes_core(
    state: &Mutex<AppState>,
    node_type: &str,
    skip: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<GraphNode>, AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    let offset = skip.unwrap_or(0);
    let count = limit.unwrap_or(100);

    let mut nodes = Vec::new();
    match nt {
        NodeType::Email => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, address, provider, notes, tags, position_x, position_y, created_at, updated_at
                     FROM emails LIMIT ?1 OFFSET ?2",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let rows = stmt
                .query_map(rusqlite::params![count, offset], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, f64>(5)?,
                        row.get::<_, f64>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, String>(8)?,
                    ))
                })
                .map_err(|e| AuthError::Database(e.to_string()))?;
            for r in rows {
                let (id, address, provider, notes_cipher, tags_str, px, py, created_at, updated_at) =
                    r.map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_plain = decrypt_notes(key, notes_cipher);
                nodes.push(GraphNode {
                    node_type: "email".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "address": address,
                        "provider": provider,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                });
            }
        }
        NodeType::Phone => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, number, carrier, notes, tags, position_x, position_y, created_at, updated_at
                     FROM phones LIMIT ?1 OFFSET ?2",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let rows = stmt
                .query_map(rusqlite::params![count, offset], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, f64>(5)?,
                        row.get::<_, f64>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, String>(8)?,
                    ))
                })
                .map_err(|e| AuthError::Database(e.to_string()))?;
            for r in rows {
                let (id, number, carrier, notes_cipher, tags_str, px, py, created_at, updated_at) =
                    r.map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_plain = decrypt_notes(key, notes_cipher);
                nodes.push(GraphNode {
                    node_type: "phone".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "number": number,
                        "carrier": carrier,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                });
            }
        }
        NodeType::Service => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, url, category, icon_url, notes, tags, position_x, position_y, created_at, updated_at
                     FROM services LIMIT ?1 OFFSET ?2",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let rows = stmt
                .query_map(rusqlite::params![count, offset], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<String>>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, f64>(7)?,
                        row.get::<_, f64>(8)?,
                        row.get::<_, String>(9)?,
                        row.get::<_, String>(10)?,
                    ))
                })
                .map_err(|e| AuthError::Database(e.to_string()))?;
            for r in rows {
                let (id, name, url, category, icon_url, notes_cipher, tags_str, px, py, created_at, updated_at) =
                    r.map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_plain = decrypt_notes(key, notes_cipher);
                nodes.push(GraphNode {
                    node_type: "service".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "name": name,
                        "url": url,
                        "category": category,
                        "icon_url": icon_url,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                });
            }
        }
        NodeType::Account => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, username, service_id, primary_email_id, notes, tags, position_x, position_y, created_at, updated_at
                     FROM accounts LIMIT ?1 OFFSET ?2",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let rows = stmt
                .query_map(rusqlite::params![count, offset], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, f64>(6)?,
                        row.get::<_, f64>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                    ))
                })
                .map_err(|e| AuthError::Database(e.to_string()))?;
            for r in rows {
                let (id, username, service_id, primary_email_id, notes_cipher, tags_str, px, py, created_at, updated_at) =
                    r.map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_plain = decrypt_notes(key, notes_cipher);
                nodes.push(GraphNode {
                    node_type: "account".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "username": username,
                        "service_id": service_id,
                        "primary_email_id": primary_email_id,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                });
            }
        }
    }

    Ok(nodes)
}

fn query_node_by_id(
    conn: &Connection,
    key: &[u8; 32],
    nt: NodeType,
    node_id: &str,
) -> Result<GraphNode, AuthError> {
    match nt {
        NodeType::Email => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, address, provider, notes, tags, position_x, position_y, created_at, updated_at
                     FROM emails WHERE id = ?1",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let mut rows = stmt
                .query(rusqlite::params![node_id])
                .map_err(|e| AuthError::Database(e.to_string()))?;
            if let Some(row) = rows.next().map_err(|e| AuthError::Database(e.to_string()))? {
                let id: String = row.get(0).map_err(|e| AuthError::Database(e.to_string()))?;
                let address: String = row.get(1).map_err(|e| AuthError::Database(e.to_string()))?;
                let provider: Option<String> =
                    row.get(2).map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_cipher: Option<String> =
                    row.get(3).map_err(|e| AuthError::Database(e.to_string()))?;
                let tags_str: String = row.get(4).map_err(|e| AuthError::Database(e.to_string()))?;
                let px: f64 = row.get(5).map_err(|e| AuthError::Database(e.to_string()))?;
                let py: f64 = row.get(6).map_err(|e| AuthError::Database(e.to_string()))?;
                let created_at: String =
                    row.get(7).map_err(|e| AuthError::Database(e.to_string()))?;
                let updated_at: String =
                    row.get(8).map_err(|e| AuthError::Database(e.to_string()))?;

                let notes_plain = decrypt_notes(key, notes_cipher);
                Ok(GraphNode {
                    node_type: "email".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "address": address,
                        "provider": provider,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                })
            } else {
                Err(AuthError::NotFound(format!("Email node {} not found", node_id)))
            }
        }
        NodeType::Phone => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, number, carrier, notes, tags, position_x, position_y, created_at, updated_at
                     FROM phones WHERE id = ?1",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let mut rows = stmt
                .query(rusqlite::params![node_id])
                .map_err(|e| AuthError::Database(e.to_string()))?;
            if let Some(row) = rows.next().map_err(|e| AuthError::Database(e.to_string()))? {
                let id: String = row.get(0).map_err(|e| AuthError::Database(e.to_string()))?;
                let number: String = row.get(1).map_err(|e| AuthError::Database(e.to_string()))?;
                let carrier: Option<String> =
                    row.get(2).map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_cipher: Option<String> =
                    row.get(3).map_err(|e| AuthError::Database(e.to_string()))?;
                let tags_str: String = row.get(4).map_err(|e| AuthError::Database(e.to_string()))?;
                let px: f64 = row.get(5).map_err(|e| AuthError::Database(e.to_string()))?;
                let py: f64 = row.get(6).map_err(|e| AuthError::Database(e.to_string()))?;
                let created_at: String =
                    row.get(7).map_err(|e| AuthError::Database(e.to_string()))?;
                let updated_at: String =
                    row.get(8).map_err(|e| AuthError::Database(e.to_string()))?;

                let notes_plain = decrypt_notes(key, notes_cipher);
                Ok(GraphNode {
                    node_type: "phone".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "number": number,
                        "carrier": carrier,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                })
            } else {
                Err(AuthError::NotFound(format!("Phone node {} not found", node_id)))
            }
        }
        NodeType::Service => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, name, url, category, icon_url, notes, tags, position_x, position_y, created_at, updated_at
                     FROM services WHERE id = ?1",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let mut rows = stmt
                .query(rusqlite::params![node_id])
                .map_err(|e| AuthError::Database(e.to_string()))?;
            if let Some(row) = rows.next().map_err(|e| AuthError::Database(e.to_string()))? {
                let id: String = row.get(0).map_err(|e| AuthError::Database(e.to_string()))?;
                let name: String = row.get(1).map_err(|e| AuthError::Database(e.to_string()))?;
                let url: Option<String> =
                    row.get(2).map_err(|e| AuthError::Database(e.to_string()))?;
                let category: Option<String> =
                    row.get(3).map_err(|e| AuthError::Database(e.to_string()))?;
                let icon_url: Option<String> =
                    row.get(4).map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_cipher: Option<String> =
                    row.get(5).map_err(|e| AuthError::Database(e.to_string()))?;
                let tags_str: String = row.get(6).map_err(|e| AuthError::Database(e.to_string()))?;
                let px: f64 = row.get(7).map_err(|e| AuthError::Database(e.to_string()))?;
                let py: f64 = row.get(8).map_err(|e| AuthError::Database(e.to_string()))?;
                let created_at: String =
                    row.get(9).map_err(|e| AuthError::Database(e.to_string()))?;
                let updated_at: String =
                    row.get(10).map_err(|e| AuthError::Database(e.to_string()))?;

                let notes_plain = decrypt_notes(key, notes_cipher);
                Ok(GraphNode {
                    node_type: "service".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "name": name,
                        "url": url,
                        "category": category,
                        "icon_url": icon_url,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                })
            } else {
                Err(AuthError::NotFound(format!("Service node {} not found", node_id)))
            }
        }
        NodeType::Account => {
            let mut stmt = conn
                .prepare(
                    "SELECT id, username, service_id, primary_email_id, notes, tags, position_x, position_y, created_at, updated_at
                     FROM accounts WHERE id = ?1",
                )
                .map_err(|e| AuthError::Database(e.to_string()))?;
            let mut rows = stmt
                .query(rusqlite::params![node_id])
                .map_err(|e| AuthError::Database(e.to_string()))?;
            if let Some(row) = rows.next().map_err(|e| AuthError::Database(e.to_string()))? {
                let id: String = row.get(0).map_err(|e| AuthError::Database(e.to_string()))?;
                let username: String = row.get(1).map_err(|e| AuthError::Database(e.to_string()))?;
                let service_id: String =
                    row.get(2).map_err(|e| AuthError::Database(e.to_string()))?;
                let primary_email_id: Option<String> =
                    row.get(3).map_err(|e| AuthError::Database(e.to_string()))?;
                let notes_cipher: Option<String> =
                    row.get(4).map_err(|e| AuthError::Database(e.to_string()))?;
                let tags_str: String = row.get(5).map_err(|e| AuthError::Database(e.to_string()))?;
                let px: f64 = row.get(6).map_err(|e| AuthError::Database(e.to_string()))?;
                let py: f64 = row.get(7).map_err(|e| AuthError::Database(e.to_string()))?;
                let created_at: String =
                    row.get(8).map_err(|e| AuthError::Database(e.to_string()))?;
                let updated_at: String =
                    row.get(9).map_err(|e| AuthError::Database(e.to_string()))?;

                let notes_plain = decrypt_notes(key, notes_cipher);
                Ok(GraphNode {
                    node_type: "account".to_string(),
                    data: serde_json::json!({
                        "id": id,
                        "username": username,
                        "service_id": service_id,
                        "primary_email_id": primary_email_id,
                        "notes": notes_plain,
                        "tags": parse_tags(&tags_str),
                        "position_x": px,
                        "position_y": py,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    }),
                })
            } else {
                Err(AuthError::NotFound(format!("Account node {} not found", node_id)))
            }
        }
    }
}

pub fn get_node_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
) -> Result<GraphNode, AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    query_node_by_id(conn, key, nt, node_id)
}

pub fn create_node_core(
    state: &Mutex<AppState>,
    node_type: &str,
    data: serde_json::Value,
) -> Result<GraphNode, AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let raw_pwd = data
        .get("password_raw")
        .or_else(|| data.get("password"))
        .and_then(|v| v.as_str());
    let notes_plain = data.get("notes").and_then(|v| v.as_str());

    let encrypted_pwd = encrypt_password(key, raw_pwd)?;
    let encrypted_notes = encrypt_notes(key, notes_plain)?;

    let tags = data
        .get("tags")
        .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
        .unwrap_or_default();
    let tags_json = serialize_tags(&tags);

    let px = data.get("position_x").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let py = data.get("position_y").and_then(|v| v.as_f64()).unwrap_or(0.0);

    match nt {
        NodeType::Email => {
            let address = data
                .get("address")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AuthError::Validation("address is required for Email".into()))?;
            let provider = data.get("provider").and_then(|v| v.as_str());

            conn.execute(
                "INSERT INTO emails (id, address, provider, password_encrypted, notes, tags, position_x, position_y, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![id, address, provider, encrypted_pwd, encrypted_notes, tags_json, px, py, now, now],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Phone => {
            let number = data
                .get("number")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AuthError::Validation("number is required for Phone".into()))?;
            let carrier = data.get("carrier").and_then(|v| v.as_str());

            conn.execute(
                "INSERT INTO phones (id, number, carrier, notes, tags, position_x, position_y, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![id, number, carrier, encrypted_notes, tags_json, px, py, now, now],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Service => {
            let name = data
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AuthError::Validation("name is required for Service".into()))?;
            let url = data.get("url").and_then(|v| v.as_str());
            let category = data.get("category").and_then(|v| v.as_str());
            let icon_url = data.get("icon_url").and_then(|v| v.as_str());

            conn.execute(
                "INSERT INTO services (id, name, url, category, icon_url, notes, tags, position_x, position_y, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                rusqlite::params![id, name, url, category, icon_url, encrypted_notes, tags_json, px, py, now, now],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Account => {
            let username = data
                .get("username")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AuthError::Validation("username is required for Account".into()))?;
            let service_id = data
                .get("service_id")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AuthError::Validation("service_id is required for Account".into()))?;
            let primary_email_id = data
                .get("primary_email_id")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty());

            conn.execute(
                "INSERT INTO accounts (id, username, password_encrypted, service_id, primary_email_id, notes, tags, position_x, position_y, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                rusqlite::params![id, username, encrypted_pwd, service_id, primary_email_id, encrypted_notes, tags_json, px, py, now, now],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
    }

    query_node_by_id(conn, key, nt, &id)
}

pub fn update_node_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
    data: serde_json::Value,
) -> Result<GraphNode, AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    let now = chrono::Utc::now().to_rfc3339();

    match nt {
        NodeType::Email => {
            let (existing_addr, existing_provider, existing_pwd, existing_notes, existing_tags, existing_px, existing_py): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                String,
                f64,
                f64,
            ) = conn
                .query_row(
                    "SELECT address, provider, password_encrypted, notes, tags, position_x, position_y FROM emails WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => AuthError::NotFound(format!("Email {} not found", node_id)),
                    other => AuthError::Database(other.to_string()),
                })?;

            let address = data.get("address").and_then(|v| v.as_str()).unwrap_or(&existing_addr);
            let provider = data
                .get("provider")
                .map(|v| v.as_str().map(String::from))
                .unwrap_or(existing_provider);

            let raw_pwd = data.get("password_raw").or_else(|| data.get("password"));
            let pwd_encrypted = if let Some(p) = raw_pwd {
                encrypt_password(key, p.as_str())?
            } else {
                existing_pwd
            };

            let notes_encrypted = if let Some(n) = data.get("notes") {
                encrypt_notes(key, n.as_str())?
            } else {
                existing_notes
            };

            let tags_json = if let Some(t) = data.get("tags") {
                let tags_vec = serde_json::from_value::<Vec<String>>(t.clone()).unwrap_or_default();
                serialize_tags(&tags_vec)
            } else {
                existing_tags
            };

            let px = data.get("position_x").and_then(|v| v.as_f64()).unwrap_or(existing_px);
            let py = data.get("position_y").and_then(|v| v.as_f64()).unwrap_or(existing_py);

            conn.execute(
                "UPDATE emails SET address = ?1, provider = ?2, password_encrypted = ?3, notes = ?4, tags = ?5, position_x = ?6, position_y = ?7, updated_at = ?8
                 WHERE id = ?9",
                rusqlite::params![address, provider, pwd_encrypted, notes_encrypted, tags_json, px, py, now, node_id],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Phone => {
            let (existing_number, existing_carrier, existing_notes, existing_tags, existing_px, existing_py): (
                String,
                Option<String>,
                Option<String>,
                String,
                f64,
                f64,
            ) = conn
                .query_row(
                    "SELECT number, carrier, notes, tags, position_x, position_y FROM phones WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => AuthError::NotFound(format!("Phone {} not found", node_id)),
                    other => AuthError::Database(other.to_string()),
                })?;

            let number = data.get("number").and_then(|v| v.as_str()).unwrap_or(&existing_number);
            let carrier = data
                .get("carrier")
                .map(|v| v.as_str().map(String::from))
                .unwrap_or(existing_carrier);

            let notes_encrypted = if let Some(n) = data.get("notes") {
                encrypt_notes(key, n.as_str())?
            } else {
                existing_notes
            };

            let tags_json = if let Some(t) = data.get("tags") {
                let tags_vec = serde_json::from_value::<Vec<String>>(t.clone()).unwrap_or_default();
                serialize_tags(&tags_vec)
            } else {
                existing_tags
            };

            let px = data.get("position_x").and_then(|v| v.as_f64()).unwrap_or(existing_px);
            let py = data.get("position_y").and_then(|v| v.as_f64()).unwrap_or(existing_py);

            conn.execute(
                "UPDATE phones SET number = ?1, carrier = ?2, notes = ?3, tags = ?4, position_x = ?5, position_y = ?6, updated_at = ?7
                 WHERE id = ?8",
                rusqlite::params![number, carrier, notes_encrypted, tags_json, px, py, now, node_id],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Service => {
            let (existing_name, existing_url, existing_category, existing_icon, existing_notes, existing_tags, existing_px, existing_py): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                String,
                f64,
                f64,
            ) = conn
                .query_row(
                    "SELECT name, url, category, icon_url, notes, tags, position_x, position_y FROM services WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => AuthError::NotFound(format!("Service {} not found", node_id)),
                    other => AuthError::Database(other.to_string()),
                })?;

            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or(&existing_name);
            let url = data.get("url").map(|v| v.as_str().map(String::from)).unwrap_or(existing_url);
            let category = data
                .get("category")
                .map(|v| v.as_str().map(String::from))
                .unwrap_or(existing_category);
            let icon_url = data
                .get("icon_url")
                .map(|v| v.as_str().map(String::from))
                .unwrap_or(existing_icon);

            let notes_encrypted = if let Some(n) = data.get("notes") {
                encrypt_notes(key, n.as_str())?
            } else {
                existing_notes
            };

            let tags_json = if let Some(t) = data.get("tags") {
                let tags_vec = serde_json::from_value::<Vec<String>>(t.clone()).unwrap_or_default();
                serialize_tags(&tags_vec)
            } else {
                existing_tags
            };

            let px = data.get("position_x").and_then(|v| v.as_f64()).unwrap_or(existing_px);
            let py = data.get("position_y").and_then(|v| v.as_f64()).unwrap_or(existing_py);

            conn.execute(
                "UPDATE services SET name = ?1, url = ?2, category = ?3, icon_url = ?4, notes = ?5, tags = ?6, position_x = ?7, position_y = ?8, updated_at = ?9
                 WHERE id = ?10",
                rusqlite::params![name, url, category, icon_url, notes_encrypted, tags_json, px, py, now, node_id],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
        NodeType::Account => {
            let (existing_username, existing_pwd, existing_service, existing_email, existing_notes, existing_tags, existing_px, existing_py): (
                String,
                Option<String>,
                String,
                Option<String>,
                Option<String>,
                String,
                f64,
                f64,
            ) = conn
                .query_row(
                    "SELECT username, password_encrypted, service_id, primary_email_id, notes, tags, position_x, position_y FROM accounts WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => AuthError::NotFound(format!("Account {} not found", node_id)),
                    other => AuthError::Database(other.to_string()),
                })?;

            let username = data
                .get("username")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or(&existing_username);
            let service_id = data
                .get("service_id")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or(&existing_service);
            let primary_email_id = data
                .get("primary_email_id")
                .map(|v| {
                    v.as_str()
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(String::from)
                })
                .unwrap_or(existing_email);

            let raw_pwd = data.get("password_raw").or_else(|| data.get("password"));
            let pwd_encrypted = if let Some(p) = raw_pwd {
                encrypt_password(key, p.as_str())?
            } else {
                existing_pwd
            };

            let notes_encrypted = if let Some(n) = data.get("notes") {
                encrypt_notes(key, n.as_str())?
            } else {
                existing_notes
            };

            let tags_json = if let Some(t) = data.get("tags") {
                let tags_vec = serde_json::from_value::<Vec<String>>(t.clone()).unwrap_or_default();
                serialize_tags(&tags_vec)
            } else {
                existing_tags
            };

            let px = data.get("position_x").and_then(|v| v.as_f64()).unwrap_or(existing_px);
            let py = data.get("position_y").and_then(|v| v.as_f64()).unwrap_or(existing_py);

            conn.execute(
                "UPDATE accounts SET username = ?1, password_encrypted = ?2, service_id = ?3, primary_email_id = ?4, notes = ?5, tags = ?6, position_x = ?7, position_y = ?8, updated_at = ?9
                 WHERE id = ?10",
                rusqlite::params![username, pwd_encrypted, service_id, primary_email_id, notes_encrypted, tags_json, px, py, now, node_id],
            ).map_err(|e| AuthError::Database(e.to_string()))?;
        }
    }

    query_node_by_id(conn, key, nt, node_id)
}

pub fn delete_node_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
) -> Result<(), AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let mut s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    if s.encryption_key.is_none() || s.db.is_none() {
        return Err(AuthError::NotUnlocked);
    }
    let conn = s.db.as_mut().unwrap();

    let tx = conn.transaction().map_err(|e| AuthError::Database(e.to_string()))?;

    // 1. Delete polymorphic edges connected to this node
    tx.execute(
        "DELETE FROM edges WHERE (source_type = ?1 AND source_id = ?2) OR (target_type = ?1 AND target_id = ?2)",
        rusqlite::params![nt.as_str(), node_id],
    ).map_err(|e| AuthError::Database(e.to_string()))?;

    // 2. Delete the node row using strict match
    let deleted = match nt {
        NodeType::Email => tx.execute("DELETE FROM emails WHERE id = ?1", rusqlite::params![node_id]),
        NodeType::Phone => tx.execute("DELETE FROM phones WHERE id = ?1", rusqlite::params![node_id]),
        NodeType::Service => tx.execute("DELETE FROM services WHERE id = ?1", rusqlite::params![node_id]),
        NodeType::Account => tx.execute("DELETE FROM accounts WHERE id = ?1", rusqlite::params![node_id]),
    }.map_err(|e| AuthError::Database(e.to_string()))?;

    if deleted == 0 {
        return Err(AuthError::NotFound(format!("{} node with id {} not found", nt.as_str(), node_id)));
    }

    tx.commit().map_err(|e| AuthError::Database(e.to_string()))?;
    Ok(())
}

pub fn get_node_password_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
) -> Result<Option<String>, AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    match nt {
        NodeType::Phone | NodeType::Service => Ok(None),
        NodeType::Email => {
            let cipher: Option<String> = conn
                .query_row(
                    "SELECT password_encrypted FROM emails WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| row.get(0),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        AuthError::NotFound(format!("Email {} not found", node_id))
                    }
                    other => AuthError::Database(other.to_string()),
                })?;

            match cipher {
                Some(ct) if !ct.is_empty() => {
                    let plain = crypto::decrypt_field(&ct, key)
                        .map_err(|e| AuthError::Database(e.to_string()))?;
                    Ok(Some(plain))
                }
                _ => Ok(None),
            }
        }
        NodeType::Account => {
            let cipher: Option<String> = conn
                .query_row(
                    "SELECT password_encrypted FROM accounts WHERE id = ?1",
                    rusqlite::params![node_id],
                    |row| row.get(0),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        AuthError::NotFound(format!("Account {} not found", node_id))
                    }
                    other => AuthError::Database(other.to_string()),
                })?;

            match cipher {
                Some(ct) if !ct.is_empty() => {
                    let plain = crypto::decrypt_field(&ct, key)
                        .map_err(|e| AuthError::Database(e.to_string()))?;
                    Ok(Some(plain))
                }
                _ => Ok(None),
            }
        }
    }
}

pub fn update_node_position_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
    x: f64,
    y: f64,
) -> Result<(), AuthError> {
    let nt = NodeType::parse(node_type).map_err(AuthError::Validation)?;
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let affected = match nt {
        NodeType::Email => conn.execute(
            "UPDATE emails SET position_x = ?1, position_y = ?2 WHERE id = ?3",
            rusqlite::params![x, y, node_id],
        ),
        NodeType::Phone => conn.execute(
            "UPDATE phones SET position_x = ?1, position_y = ?2 WHERE id = ?3",
            rusqlite::params![x, y, node_id],
        ),
        NodeType::Service => conn.execute(
            "UPDATE services SET position_x = ?1, position_y = ?2 WHERE id = ?3",
            rusqlite::params![x, y, node_id],
        ),
        NodeType::Account => conn.execute(
            "UPDATE accounts SET position_x = ?1, position_y = ?2 WHERE id = ?3",
            rusqlite::params![x, y, node_id],
        ),
    }
    .map_err(|e| AuthError::Database(e.to_string()))?;

    if affected == 0 {
        return Err(AuthError::NotFound(format!("{} {} not found", nt.as_str(), node_id)));
    }
    Ok(())
}

pub fn get_edges_core(
    state: &Mutex<AppState>,
    node_type: Option<String>,
    node_id: Option<String>,
) -> Result<Vec<Edge>, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let mut edges = Vec::new();
    if let (Some(nt), Some(nid)) = (node_type, node_id) {
        let mut stmt = conn
            .prepare(
                "SELECT id, source_type, source_id, target_type, target_id, relation, notes, created_at
                 FROM edges
                 WHERE (source_type = ?1 AND source_id = ?2) OR (target_type = ?1 AND target_id = ?2)",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(rusqlite::params![nt, nid], |row| {
                Ok(Edge {
                    id: row.get(0)?,
                    source_type: row.get(1)?,
                    source_id: row.get(2)?,
                    target_type: row.get(3)?,
                    target_id: row.get(4)?,
                    relation: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            edges.push(r.map_err(|e| AuthError::Database(e.to_string()))?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, source_type, source_id, target_type, target_id, relation, notes, created_at FROM edges",
            )
            .map_err(|e| AuthError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Edge {
                    id: row.get(0)?,
                    source_type: row.get(1)?,
                    source_id: row.get(2)?,
                    target_type: row.get(3)?,
                    target_id: row.get(4)?,
                    relation: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .map_err(|e| AuthError::Database(e.to_string()))?;

        for r in rows {
            edges.push(r.map_err(|e| AuthError::Database(e.to_string()))?);
        }
    }
    Ok(edges)
}

pub fn create_edge_core(
    state: &Mutex<AppState>,
    edge: EdgeCreatePayload,
) -> Result<Edge, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO edges (id, source_type, source_id, target_type, target_id, relation, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            edge.source_type,
            edge.source_id,
            edge.target_type,
            edge.target_id,
            edge.relation,
            edge.notes,
            created_at,
        ],
    ).map_err(|e| AuthError::Database(e.to_string()))?;

    Ok(Edge {
        id,
        source_type: edge.source_type,
        source_id: edge.source_id,
        target_type: edge.target_type,
        target_id: edge.target_id,
        relation: edge.relation,
        notes: edge.notes,
        created_at,
    })
}

pub fn update_edge_core(
    state: &Mutex<AppState>,
    edge_id: &str,
    payload: EdgeUpdatePayload,
) -> Result<Edge, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let mut edge: Edge = conn
        .query_row(
            "SELECT id, source_type, source_id, target_type, target_id, relation, notes, created_at FROM edges WHERE id = ?1",
            rusqlite::params![edge_id],
            |row| {
                Ok(Edge {
                    id: row.get(0)?,
                    source_type: row.get(1)?,
                    source_id: row.get(2)?,
                    target_type: row.get(3)?,
                    target_id: row.get(4)?,
                    relation: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AuthError::NotFound(format!("Edge {} not found", edge_id))
            }
            other => AuthError::Database(other.to_string()),
        })?;

    if let Some(rel) = payload.relation {
        edge.relation = rel;
    }
    if let Some(notes) = payload.notes {
        edge.notes = Some(notes);
    }

    conn.execute(
        "UPDATE edges SET relation = ?1, notes = ?2 WHERE id = ?3",
        rusqlite::params![edge.relation, edge.notes, edge.id],
    )
    .map_err(|e| AuthError::Database(e.to_string()))?;

    Ok(edge)
}

pub fn delete_edge_core(state: &Mutex<AppState>, edge_id: &str) -> Result<(), AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let affected = conn
        .execute("DELETE FROM edges WHERE id = ?1", rusqlite::params![edge_id])
        .map_err(|e| AuthError::Database(e.to_string()))?;

    if affected == 0 {
        return Err(AuthError::NotFound(format!("Edge {} not found", edge_id)));
    }
    Ok(())
}

pub fn get_subgraph_core(
    state: &Mutex<AppState>,
    node_type: &str,
    node_id: &str,
    _depth: Option<u32>,
) -> Result<serde_json::Value, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, target_id, relation FROM edges
             WHERE (source_type = ?1 AND source_id = ?2) OR (target_type = ?1 AND target_id = ?2)",
        )
        .map_err(|e| AuthError::Database(e.to_string()))?;

    let rows = stmt
        .query_map(rusqlite::params![node_type, node_id], |row| {
            let id: String = row.get(0)?;
            let source: String = row.get(1)?;
            let target: String = row.get(2)?;
            let relation: String = row.get(3)?;
            Ok(serde_json::json!({
                "id": id,
                "source": source,
                "target": target,
                "relation": relation,
            }))
        })
        .map_err(|e| AuthError::Database(e.to_string()))?;

    let mut edges = Vec::new();
    for r in rows {
        edges.push(r.map_err(|e| AuthError::Database(e.to_string()))?);
    }
    Ok(serde_json::json!({ "edges": edges }))
}

pub fn search_core(
    state: &Mutex<AppState>,
    query: &str,
    types: Option<Vec<String>>,
) -> Result<Vec<GraphNode>, AuthError> {
    let s = state.lock().map_err(|_| AuthError::Database("Lock poisoned".into()))?;
    let conn = s.db.as_ref().ok_or(AuthError::NotUnlocked)?;
    let key = s.encryption_key.as_ref().ok_or(AuthError::NotUnlocked)?;

    let q_lower = query.trim().to_lowercase();
    if q_lower.is_empty() {
        return Ok(Vec::new());
    }

    let target_types: Vec<NodeType> = if let Some(type_list) = types {
        type_list.into_iter().filter_map(|t| NodeType::parse(&t).ok()).collect()
    } else {
        vec![
            NodeType::Email,
            NodeType::Phone,
            NodeType::Service,
            NodeType::Account,
        ]
    };

    let mut matched = Vec::new();

    for nt in target_types {
        match nt {
            NodeType::Email => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, address, provider, notes, tags, position_x, position_y, created_at, updated_at FROM emails",
                    )
                    .map_err(|e| AuthError::Database(e.to_string()))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, Option<String>>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, String>(4)?,
                            row.get::<_, f64>(5)?,
                            row.get::<_, f64>(6)?,
                            row.get::<_, String>(7)?,
                            row.get::<_, String>(8)?,
                        ))
                    })
                    .map_err(|e| AuthError::Database(e.to_string()))?;

                for r in rows {
                    let (id, address, provider, notes_cipher, tags_str, px, py, created_at, updated_at) =
                        r.map_err(|e| AuthError::Database(e.to_string()))?;
                    let notes_plain = decrypt_notes(key, notes_cipher);
                    let tags = parse_tags(&tags_str);

                    let hits_addr = address.to_lowercase().contains(&q_lower);
                    let hits_prov = provider
                        .as_deref()
                        .map(|p| p.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_notes = notes_plain
                        .as_deref()
                        .map(|n| n.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_tags = tags.iter().any(|t| t.to_lowercase().contains(&q_lower));

                    if hits_addr || hits_prov || hits_notes || hits_tags {
                        matched.push(GraphNode {
                            node_type: "email".to_string(),
                            data: serde_json::json!({
                                "id": id,
                                "address": address,
                                "provider": provider,
                                "notes": notes_plain,
                                "tags": tags,
                                "position_x": px,
                                "position_y": py,
                                "created_at": created_at,
                                "updated_at": updated_at,
                            }),
                        });
                    }
                }
            }
            NodeType::Phone => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, number, carrier, notes, tags, position_x, position_y, created_at, updated_at FROM phones",
                    )
                    .map_err(|e| AuthError::Database(e.to_string()))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, Option<String>>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, String>(4)?,
                            row.get::<_, f64>(5)?,
                            row.get::<_, f64>(6)?,
                            row.get::<_, String>(7)?,
                            row.get::<_, String>(8)?,
                        ))
                    })
                    .map_err(|e| AuthError::Database(e.to_string()))?;

                for r in rows {
                    let (id, number, carrier, notes_cipher, tags_str, px, py, created_at, updated_at) =
                        r.map_err(|e| AuthError::Database(e.to_string()))?;
                    let notes_plain = decrypt_notes(key, notes_cipher);
                    let tags = parse_tags(&tags_str);

                    let hits_num = number.to_lowercase().contains(&q_lower);
                    let hits_carr = carrier
                        .as_deref()
                        .map(|c| c.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_notes = notes_plain
                        .as_deref()
                        .map(|n| n.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_tags = tags.iter().any(|t| t.to_lowercase().contains(&q_lower));

                    if hits_num || hits_carr || hits_notes || hits_tags {
                        matched.push(GraphNode {
                            node_type: "phone".to_string(),
                            data: serde_json::json!({
                                "id": id,
                                "number": number,
                                "carrier": carrier,
                                "notes": notes_plain,
                                "tags": tags,
                                "position_x": px,
                                "position_y": py,
                                "created_at": created_at,
                                "updated_at": updated_at,
                            }),
                        });
                    }
                }
            }
            NodeType::Service => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, name, url, category, icon_url, notes, tags, position_x, position_y, created_at, updated_at FROM services",
                    )
                    .map_err(|e| AuthError::Database(e.to_string()))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, Option<String>>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, Option<String>>(5)?,
                            row.get::<_, String>(6)?,
                            row.get::<_, f64>(7)?,
                            row.get::<_, f64>(8)?,
                            row.get::<_, String>(9)?,
                            row.get::<_, String>(10)?,
                        ))
                    })
                    .map_err(|e| AuthError::Database(e.to_string()))?;

                for r in rows {
                    let (id, name, url, category, icon_url, notes_cipher, tags_str, px, py, created_at, updated_at) =
                        r.map_err(|e| AuthError::Database(e.to_string()))?;
                    let notes_plain = decrypt_notes(key, notes_cipher);
                    let tags = parse_tags(&tags_str);

                    let hits_name = name.to_lowercase().contains(&q_lower);
                    let hits_url = url
                        .as_deref()
                        .map(|u| u.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_cat = category
                        .as_deref()
                        .map(|c| c.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_notes = notes_plain
                        .as_deref()
                        .map(|n| n.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_tags = tags.iter().any(|t| t.to_lowercase().contains(&q_lower));

                    if hits_name || hits_url || hits_cat || hits_notes || hits_tags {
                        matched.push(GraphNode {
                            node_type: "service".to_string(),
                            data: serde_json::json!({
                                "id": id,
                                "name": name,
                                "url": url,
                                "category": category,
                                "icon_url": icon_url,
                                "notes": notes_plain,
                                "tags": tags,
                                "position_x": px,
                                "position_y": py,
                                "created_at": created_at,
                                "updated_at": updated_at,
                            }),
                        });
                    }
                }
            }
            NodeType::Account => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, username, service_id, primary_email_id, notes, tags, position_x, position_y, created_at, updated_at FROM accounts",
                    )
                    .map_err(|e| AuthError::Database(e.to_string()))?;
                let rows = stmt
                    .query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, String>(5)?,
                            row.get::<_, f64>(6)?,
                            row.get::<_, f64>(7)?,
                            row.get::<_, String>(8)?,
                            row.get::<_, String>(9)?,
                        ))
                    })
                    .map_err(|e| AuthError::Database(e.to_string()))?;

                for r in rows {
                    let (id, username, service_id, primary_email_id, notes_cipher, tags_str, px, py, created_at, updated_at) =
                        r.map_err(|e| AuthError::Database(e.to_string()))?;
                    let notes_plain = decrypt_notes(key, notes_cipher);
                    let tags = parse_tags(&tags_str);

                    let hits_user = username.to_lowercase().contains(&q_lower);
                    let hits_notes = notes_plain
                        .as_deref()
                        .map(|n| n.to_lowercase().contains(&q_lower))
                        .unwrap_or(false);
                    let hits_tags = tags.iter().any(|t| t.to_lowercase().contains(&q_lower));

                    if hits_user || hits_notes || hits_tags {
                        matched.push(GraphNode {
                            node_type: "account".to_string(),
                            data: serde_json::json!({
                                "id": id,
                                "username": username,
                                "service_id": service_id,
                                "primary_email_id": primary_email_id,
                                "notes": notes_plain,
                                "tags": tags,
                                "position_x": px,
                                "position_y": py,
                                "created_at": created_at,
                                "updated_at": updated_at,
                            }),
                        });
                    }
                }
            }
        }
    }

    Ok(matched)
}

pub fn generate_password_core() -> Result<serde_json::Value, AuthError> {
    let mut bytes = [0u8; 12];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut bytes);
    let hex_pwd = bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    Ok(serde_json::json!({ "password": hex_pwd }))
}

// =========================================================================
// Napi Wrappers
// =========================================================================

use napi_derive::napi;

#[napi]
pub fn cmd_get_graph() -> napi::Result<GraphData> {
    get_graph_core(&crate::state::GLOBAL_APP_STATE).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_get_nodes(
    node_type: String,
    skip: Option<u32>,
    limit: Option<u32>,
) -> napi::Result<Vec<GraphNode>> {
    get_nodes_core(&crate::state::GLOBAL_APP_STATE, &node_type, skip, limit)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_get_node(node_type: String, node_id: String) -> napi::Result<GraphNode> {
    get_node_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_create_node(node_type: String, data: serde_json::Value) -> napi::Result<GraphNode> {
    create_node_core(&crate::state::GLOBAL_APP_STATE, &node_type, data)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_update_node(
    node_type: String,
    node_id: String,
    data: serde_json::Value,
) -> napi::Result<GraphNode> {
    update_node_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id, data)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_delete_node(node_type: String, node_id: String) -> napi::Result<()> {
    delete_node_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_get_node_password(node_type: String, node_id: String) -> napi::Result<Option<String>> {
    get_node_password_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_update_node_position(
    node_type: String,
    node_id: String,
    x: f64,
    y: f64,
) -> napi::Result<()> {
    update_node_position_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id, x, y)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_get_edges(
    node_type: Option<String>,
    node_id: Option<String>,
) -> napi::Result<Vec<Edge>> {
    get_edges_core(&crate::state::GLOBAL_APP_STATE, node_type, node_id)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_create_edge(edge: EdgeCreatePayload) -> napi::Result<Edge> {
    create_edge_core(&crate::state::GLOBAL_APP_STATE, edge).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_update_edge(edge_id: String, payload: EdgeUpdatePayload) -> napi::Result<Edge> {
    update_edge_core(&crate::state::GLOBAL_APP_STATE, &edge_id, payload)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_delete_edge(edge_id: String) -> napi::Result<()> {
    delete_edge_core(&crate::state::GLOBAL_APP_STATE, &edge_id).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_get_subgraph(
    node_type: String,
    node_id: String,
    depth: Option<u32>,
) -> napi::Result<serde_json::Value> {
    get_subgraph_core(&crate::state::GLOBAL_APP_STATE, &node_type, &node_id, depth)
        .map_err(napi::Error::from)
}

#[napi]
pub fn cmd_search(query: String, types: Option<Vec<String>>) -> napi::Result<Vec<GraphNode>> {
    search_core(&crate::state::GLOBAL_APP_STATE, &query, types).map_err(napi::Error::from)
}

#[napi]
pub fn cmd_generate_password() -> napi::Result<serde_json::Value> {
    generate_password_core().map_err(napi::Error::from)
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use zeroize::Zeroizing;
    use crate::schema::create_schema;

    fn setup_test_state() -> (Mutex<AppState>, [u8; 32]) {
        let conn = Connection::open_in_memory().unwrap();
        create_schema(&conn).unwrap();

        let key = [42u8; 32];
        let mut app_state = AppState::new();
        app_state.db = Some(conn);
        app_state.encryption_key = Some(Zeroizing::new(key));

        (Mutex::new(app_state), key)
    }

    #[tokio::test]
    async fn test_node_crud_and_encryption_roundtrip() {
        let (state, key) = setup_test_state();

        // 1. Create email node
        let create_data = serde_json::json!({
            "address": "alice@example.com",
            "provider": "ProtonMail",
            "password_raw": "supersecret123",
            "notes": "my secret notes",
            "tags": ["personal", "primary"],
            "position_x": 120.0,
            "position_y": 340.0,
        });

        let created = create_node_core(&state, "email", create_data).unwrap();

        assert_eq!(created.node_type, "email");
        let node_id = created.data["id"].as_str().unwrap().to_string();
        assert_eq!(created.data["address"], "alice@example.com");
        assert_eq!(created.data["notes"], "my secret notes");
        assert_eq!(created.data["position_x"], 120.0);
        assert_eq!(created.data["position_y"], 340.0);
        // Password MUST NOT be present in GraphNode response
        assert!(created.data.get("password_encrypted").is_none());
        assert!(created.data.get("password").is_none());

        // 2. Verify raw DB row has ENCRYPTED password and notes (NOT plaintext!)
        {
            let s = state.lock().unwrap();
            let conn = s.db.as_ref().unwrap();
            let (raw_pwd, raw_notes): (String, String) = conn
                .query_row(
                    "SELECT password_encrypted, notes FROM emails WHERE id = ?1",
                    rusqlite::params![node_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .unwrap();

            assert_ne!(raw_pwd, "supersecret123");
            assert_ne!(raw_notes, "my secret notes");

            // Decrypt raw values manually to confirm AES-256-GCM validity
            let dec_pwd = crypto::decrypt_field(&raw_pwd, &key).unwrap();
            let dec_notes = crypto::decrypt_field(&raw_notes, &key).unwrap();
            assert_eq!(dec_pwd, "supersecret123");
            assert_eq!(dec_notes, "my secret notes");
        }

        // 3. Test on-demand password retrieval
        let fetched_pwd = get_node_password_core(&state, "email", &node_id).unwrap();
        assert_eq!(fetched_pwd, Some("supersecret123".to_string()));

        // 4. Update node position and notes
        update_node_position_core(&state, "email", &node_id, 500.0, 600.0).unwrap();

        let update_data = serde_json::json!({
            "notes": "updated secret notes",
            "tags": ["personal", "work"],
        });
        let updated = update_node_core(&state, "email", &node_id, update_data).unwrap();
        assert_eq!(updated.data["notes"], "updated secret notes");
        assert_eq!(updated.data["position_x"], 500.0);
        assert_eq!(updated.data["position_y"], 600.0);
        assert_eq!(
            updated.data["tags"],
            serde_json::json!(["personal", "work"])
        );

        // 5. Delete node
        delete_node_core(&state, "email", &node_id).unwrap();

        // 6. Confirm node is gone
        let get_res = get_node_core(&state, "email", &node_id);
        assert!(matches!(get_res, Err(AuthError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_node_transaction_cascades_polymorphic_edges() {
        let (state, _) = setup_test_state();

        // Create service node
        let srv = create_node_core(
            &state,
            "service",
            serde_json::json!({
                "name": "GitHub",
                "url": "https://github.com",
            }),
        )
        .unwrap();
        let srv_id = srv.data["id"].as_str().unwrap().to_string();

        // Create email node
        let eml = create_node_core(
            &state,
            "email",
            serde_json::json!({
                "address": "octocat@github.com",
            }),
        )
        .unwrap();
        let eml_id = eml.data["id"].as_str().unwrap().to_string();

        // Create polymorphic edge between email and service
        let edge = create_edge_core(
            &state,
            EdgeCreatePayload {
                source_type: "email".into(),
                source_id: eml_id.clone(),
                target_type: "service".into(),
                target_id: srv_id.clone(),
                relation: "registered_with".into(),
                notes: Some("primary account".into()),
            },
        )
        .unwrap();

        assert_eq!(edge.relation, "registered_with");

        // Verify edge exists
        let edges = get_edges_core(&state, None, None).unwrap();
        assert_eq!(edges.len(), 1);

        // Delete email node -> MUST delete connected edge in single transaction
        delete_node_core(&state, "email", &eml_id).unwrap();

        // Verify edge was automatically cleaned up
        let edges_after = get_edges_core(&state, None, None).unwrap();
        assert_eq!(edges_after.len(), 0);
    }

    #[tokio::test]
    async fn test_commands_return_not_unlocked_when_locked() {
        let app_state = AppState::new(); // db is None, encryption_key is None
        let state = Mutex::new(app_state);

        let res = get_graph_core(&state);
        assert_eq!(res, Err(AuthError::NotUnlocked));

        let res = create_node_core(&state, "email", serde_json::json!({}));
        assert_eq!(res, Err(AuthError::NotUnlocked));

        let res = delete_node_core(&state, "email", "some-id");
        assert_eq!(res, Err(AuthError::NotUnlocked));
    }
}
