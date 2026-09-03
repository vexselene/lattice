# Lattice — Tauri & Rust Backend Migration Audit

**System:** Lattice Visual Identity & Account Graph  
**Target:** Python/FastAPI Backend $\longrightarrow$ Native Rust Backend with Tauri v2  
**Date:** September 2026  
**Scope:** Complete backend API surface, data layer, cryptography, session lifecycle, filesystem paths, dependencies, build tooling, and client-side persistence inventory.

---

## 1. Complete API Surface Inventory

The FastAPI backend exposes 19 REST endpoints in `backend/app/main.py`. Below is the complete catalog of routes, their input/output schemas, and their direct frontend call sites across `frontend/src/`. Each entry represents a backend capability that must transition into a native Tauri command (`#[tauri::command]`).

| # | HTTP Method & Route | Backend Handler | Request Schema / Parameters | Response Schema | Frontend Call Site(s) | Tauri Command Proposal | Notes & Invocations |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `POST /api/auth/setup` | `main.py:50` `setup_auth` | `schemas.SetupRequest`:<br>• `master_password: str` | `{"success": bool}` | `frontend/src/api/auth.ts:4`<br>↳ `UnlockScreen.tsx:30` | `cmd_auth_setup(password)` | Sets up master salt (`lattice.salt`), initializes SQLCipher DB, wraps Fernet key. |
| **2** | `POST /api/auth/unlock` | `main.py:76` `unlock_auth` | `schemas.UnlockRequest`:<br>• `master_password: str` | `{"session_token": str, "expires_at": null}` | `frontend/src/api/auth.ts:9`<br>↳ `UnlockScreen.tsx:33` | `cmd_auth_unlock(password)` | Derives DB key, opens DB, unwraps Fernet key into session memory, issues token. |
| **3** | `POST /api/auth/lock` | `main.py:109` `lock_auth` | Header: `session-token: Optional[str]` | `{"success": bool}` | `frontend/src/api/auth.ts:14`<br>↳ `AutoLockTimer.tsx:17`<br>↳ `TopBar.tsx:16` | `cmd_auth_lock()` | Disposes SQLCipher engine connection, purges Fernet key from in-memory session. |
| **4** | `GET /api/auth/status` | `main.py:116` `auth_status` | Header: `session-token: Optional[str]` | `{"unlocked": bool, "auto_lock_minutes": int}` | `frontend/src/api/auth.ts:19`<br>↳ `UnlockScreen.tsx:13` | `cmd_auth_status()` | Checks if DB engine is open and session is valid. Reads `auto_lock_minutes` setting. |
| **5** | `PATCH /api/auth/settings` | `main.py:131` `update_settings` | `schemas.SettingsUpdate`:<br>• `auto_lock_minutes: int` | `{"success": bool}` | `frontend/src/api/auth.ts:24`<br>*(Defined in client; ready for settings modal)* | `cmd_update_settings(auto_lock_minutes)` | Persists auto-lock duration into `app_settings` table. |
| **6** | `GET /api/nodes/{node_type}` | `main.py:141` `get_nodes` | Path: `node_type: str`<br>Query: `skip: int = 0`, `limit: int = 100` | `List[NodeRecord]` (Email, Account, Service, or Phone) | `frontend/src/api/nodes.ts:5`<br>*(Defined in client)* | `cmd_get_nodes(node_type, skip, limit)` | Paged entity fetch. In practice, live canvas relies on `GET /api/graph` for bulk hydration. |
| **7** | `GET /api/nodes/{node_type}/{node_id}` | `main.py:148` `get_node` | Path: `node_type: str`, `node_id: str` | `NodeRecord` | `frontend/src/api/nodes.ts:10`<br>*(Defined in client)* | `cmd_get_node(node_type, node_id)` | Fetches single node entity by UUID. |
| **8** | `POST /api/nodes/{node_type}` | `main.py:157` `create_node` | Path: `node_type: str`<br>Body: `schemas.NodeCreate`<br>• `data: Dict[str, Any]`<br>Header: `session-token: str` | `NodeRecord` (created entity with generated UUID) | `frontend/src/api/nodes.ts:15`<br>↳ `NodeForm.tsx:42`<br>↳ `AccountNode.tsx:85`<br>↳ `EmailNode.tsx:87`<br>↳ `PhoneNode.tsx:84`<br>↳ `ServiceNode.tsx:85` | `cmd_create_node(node_type, data)` | Strips UI transient keys (`isEditing`, `isExpanded`, `isDraft`), encrypts password, returns record. |
| **9** | `PUT /api/nodes/{node_type}/{node_id}` | `main.py:165` `update_node` | Path: `node_type: str`, `node_id: str`<br>Body: `schemas.NodeUpdate`<br>• `data: Dict[str, Any]`<br>Header: `session-token: str` | `NodeRecord` (updated entity) | `frontend/src/api/nodes.ts:20`<br>↳ `NodeForm.tsx:40`<br>↳ `AccountNode.tsx:109`<br>↳ `EmailNode.tsx:111`<br>↳ `PhoneNode.tsx:107`<br>↳ `ServiceNode.tsx:109`<br>↳ `graphStore.ts:122, 153` (tag edits) | `cmd_update_node(node_type, node_id, data)` | Updates attributes and tags. Re-encrypts `password_raw` if updated. Refreshes `updated_at`. |
| **10** | `DELETE /api/nodes/{node_type}/{node_id}` | `main.py:172` `delete_node` | Path: `node_type: str`, `node_id: str` | `{"success": bool}` | `frontend/src/api/nodes.ts:25`<br>↳ `graphStore.ts:172` (`deleteNode`)<br>↳ `App.tsx:41`<br>↳ `AccountNode.tsx:74`<br>↳ `EmailNode.tsx:76`<br>↳ `PhoneNode.tsx:73`<br>↳ `ServiceNode.tsx:74`<br>↳ `SelectionActionDock.tsx:57` | `cmd_delete_node(node_type, node_id)` | Deletes node and cascades deletion across all connected polymorphic edges in `edges` table. |
| **11** | `GET /api/nodes/{node_type}/{node_id}/password` | `main.py:179` `get_node_password` | Path: `node_type: str`, `node_id: str`<br>Header: `session-token: str` | `{"password": Optional[str]}` | `frontend/src/api/nodes.ts:30`<br>↳ `PasswordField.tsx:24` | `cmd_get_node_password(node_type, node_id)` | Decrypts on-demand using in-memory Fernet key without storing plaintext in state. |
| **12** | `GET /api/edges` | `main.py:189` `get_edges` | Query: `node_type?: str`, `node_id?: str` | `List[EdgeRecord]` | `frontend/src/api/edges.ts:5`<br>*(Defined in client)* | `cmd_get_edges(node_type, node_id)` | Queries polymorphic edges optionally filtered by node endpoint. |
| **13** | `POST /api/edges` | `main.py:193` `create_edge` | Body: `schemas.EdgeCreate`:<br>• `source_type: str`<br>• `source_id: str`<br>• `target_type: str`<br>• `target_id: str`<br>• `relation: str`<br>• `notes?: Optional[str]` | `EdgeRecord` (created entity with generated UUID) | `frontend/src/api/edges.ts:17`<br>↳ `EdgeForm.tsx:76`<br>↳ `AccountNode.tsx:100`<br>↳ `EmailNode.tsx:102`<br>↳ `PhoneNode.tsx:98`<br>↳ `ServiceNode.tsx:100`<br>↳ `graphStore.ts:195` (canvas drag/drop) | `cmd_create_edge(edge_data)` | Validates CheckConstraints (`ck_source_type`, `ck_target_type`, `ck_relation`) and persists edge. |
| **14** | `PUT /api/edges/{edge_id}` | `main.py:197` `update_edge` | Path: `edge_id: str`<br>Body: `schemas.EdgeUpdate`:<br>• `relation?: Optional[str]`<br>• `notes?: Optional[str]` | `EdgeRecord` (updated entity) | `frontend/src/api/edges.ts:22`<br>↳ `EdgeForm.tsx:74`<br>↳ `GlowEdge.tsx:58` (inline menu) | `cmd_update_edge(edge_id, edge_data)` | Updates edge relation or notes. |
| **15** | `DELETE /api/edges/{edge_id}` | `main.py:204` `delete_edge` | Path: `edge_id: str` | `{"success": bool}` | `frontend/src/api/edges.ts:27`<br>↳ `graphStore.ts:184` (`deleteEdge`)<br>↳ `App.tsx:53`<br>↳ `GlowEdge.tsx:50`<br>↳ `GraphCanvas.tsx:548` (reconnect) | `cmd_delete_edge(edge_id)` | Deletes single edge record. |
| **16** | `GET /api/graph` | `main.py:210` `get_graph` | None | `{"nodes": [{"type": str, "data": dict}], "edges": [dict]}` | `frontend/src/api/nodes.ts:35`<br>↳ `graphStore.ts:163` (`fetchGraph`)<br>↳ `App.tsx:32` (on unlock) | `cmd_get_graph()` | Aggregates all email, account, service, and phone nodes with edges for React Flow canvas. |
| **17** | `GET /api/graph/subgraph/{node_type}/{node_id}` | `main.py:219` `get_subgraph` | Path: `node_type: str`, `node_id: str`<br>Query: `depth: int = 1` | `{"edges": [{"id": str, "source": str, "target": str, "relation": str}]}` | `frontend/src/api/nodes.ts:40`<br>*(Defined in client; available for subgraphs)* | `cmd_get_subgraph(node_type, node_id, depth)` | Traverses 1-hop edges for target node. |
| **18** | `GET /api/search` | `main.py:225` `search` | Query: `q: str`, `types[]?: List[str]` | `{"results": [{"type": str, "data": dict}]}` | `frontend/src/api/search.ts:5`<br>*(Client defined; live UI uses in-memory filter)* | `cmd_search_graph(query, types)` | Server-side case-insensitive search across string columns. |
| **19** | `POST /api/utils/generate-password` | `main.py:244` `generate_password` | None | `{"password": str}` | `frontend/src/api/search.ts:10`<br>↳ `PasswordGenerator.tsx:11` | `cmd_generate_password()` | Returns `os.urandom(12).hex()` random string. |

---

## 2. Data Layer

### 2.1 SQLCipher Setup & Database Engine

#### Python Implementation (`backend/app/database.py`)
- **Driver / Library:** `sqlcipher3-binary==0.6.0` (`sqlcipher3` Python C-extension module).
- **Engine Connection URL:**
  ```python
  encoded_key = urllib.parse.quote_plus(db_key) # Hex-encoded derived 256-bit key
  db_url = f"sqlite+pysqlcipher://:{encoded_key}@/{DB_PATH}"
  _engine = create_engine(db_url, module=sqlcipher3)
  _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
  ```
  *(Reference: `backend/app/database.py:24-31`)*
- **Key Passing Mechanism:** The encryption key is embedded directly into the URI authority section (`sqlite+pysqlcipher://:KEY@/path`). On Unix, absolute paths require 4 slashes (`sqlite+pysqlcipher://:KEY@//abs/path`). Under the hood, `pysqlcipher3` executes SQLite `PRAGMA key = '...'` or `PRAGMA key = "x'...'"` immediately upon connection acquisition.
- **Dynamic Lifecycle:**
  - `init_db(db_key)`: Instantiates the global `_engine` and `_SessionLocal` pool, invokes `Base.metadata.create_all()`, and executes raw SQL auto-migrations.
  - `close_db()`: Disposes connection pool via `_engine.dispose()` and nulls references (`backend/app/database.py:56-61`).
  - `get_db()`: Scoped generator yielding a thread-local SQLAlchemy session, guaranteed closed via `finally: db.close()`.
- **Dynamic Schema Migration:**
  `backend/app/database.py:38-44` executes on startup:
  ```python
  with _engine.connect() as conn:
      for table in ["emails", "phones", "services", "accounts"]:
          try:
              conn.execute(text(f"ALTER TABLE {table} ADD COLUMN tags JSON"))
              conn.commit()
          except Exception:
              pass
  ```

#### Complete Database Schema & SQLAlchemy Definitions

##### Nodes Table Schemas (`backend/app/models/node.py`)
```sql
CREATE TABLE emails (
    id                 TEXT PRIMARY KEY,  -- UUIDv4
    address            TEXT NOT NULL UNIQUE,
    provider           TEXT,
    password_encrypted TEXT,
    notes              TEXT,
    tags               JSON,
    created_at         TIMESTAMP NOT NULL, -- UTC timezone-aware
    updated_at         TIMESTAMP NOT NULL
);
CREATE INDEX idx_emails_address ON emails(address);

CREATE TABLE phones (
    id                 TEXT PRIMARY KEY,
    number             TEXT NOT NULL UNIQUE,
    carrier            TEXT,
    notes              TEXT,
    tags               JSON,
    created_at         TIMESTAMP NOT NULL,
    updated_at         TIMESTAMP NOT NULL
);
CREATE INDEX idx_phones_number ON phones(number);

CREATE TABLE services (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    url                TEXT,
    category           TEXT,
    icon_url           TEXT,
    notes              TEXT,
    tags               JSON,
    created_at         TIMESTAMP NOT NULL,
    updated_at         TIMESTAMP NOT NULL
);
CREATE INDEX idx_services_name ON services(name);

CREATE TABLE accounts (
    id                 TEXT PRIMARY KEY,
    username           TEXT NOT NULL,
    password_encrypted TEXT,
    service_id         TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    primary_email_id   TEXT REFERENCES emails(id) ON DELETE SET NULL,
    notes              TEXT,
    tags               JSON,
    created_at         TIMESTAMP NOT NULL,
    updated_at         TIMESTAMP NOT NULL
);
CREATE INDEX idx_accounts_service ON accounts(service_id);
CREATE INDEX idx_accounts_email ON accounts(primary_email_id);
CREATE INDEX idx_accounts_username ON accounts(username);
```

##### Edges Table Schema (`backend/app/models/edge.py`)
```sql
CREATE TABLE edges (
    id                 TEXT PRIMARY KEY,
    source_type        TEXT NOT NULL CHECK (source_type IN ('email','account','service','phone')),
    source_id          TEXT NOT NULL,
    target_type        TEXT NOT NULL CHECK (target_type IN ('email','account','service','phone')),
    target_id          TEXT NOT NULL,
    relation           TEXT NOT NULL CHECK (relation IN ('registered_with','recovery_for','uses_username','linked_account')),
    notes              TEXT,
    created_at         TIMESTAMP NOT NULL
);
CREATE INDEX idx_edges_source ON edges(source_type, source_id);
CREATE INDEX idx_edges_target ON edges(target_type, target_id);
CREATE INDEX idx_edges_relation ON edges(relation);
```

##### Settings Table Schema (`backend/app/models/node.py:85-90`)
```sql
CREATE TABLE app_settings (
    key                TEXT PRIMARY KEY,
    value              TEXT NOT NULL
);
-- Keys used:
-- 'wrapped_fernet': Base64-encoded encrypted Fernet master key
-- 'auto_lock_minutes': String representation of integer auto-lock timeout (default: '15')
```

---

### 2.2 Cryptography Implementation (Argon2id & Fernet)

#### Python Libraries
- `cryptography==50.0.1` (`cryptography.hazmat.primitives.kdf.argon2.Argon2id`, `cryptography.fernet.Fernet`).
- *Note on `requirements.txt`:* `argon2-cffi` is installed but the active code in `backend/app/auth/crypto.py` imports Argon2id directly from `cryptography.hazmat.primitives.kdf.argon2`.

#### Exact KDF Parameters (`backend/app/auth/crypto.py:12-21`)
- **Algorithm:** Argon2id
- **Salt:** 16 cryptographically random bytes (`os.urandom(16)`), stored on disk at `backend/lattice.salt` (`crypto.py:23-24`, `main.py:48`).
- **Derived Key Length:** 32 bytes (256 bits).
- **Time Cost (Iterations):** 3
- **Parallelism (Lanes):** 4
- **Memory Cost:** 65,536 KB (64 MB).
- **Code Reference:**
  ```python
  kdf = Argon2id(
      salt=salt,
      length=32,
      iterations=3,
      lanes=4,
      memory_cost=65536,
  )
  db_key = kdf.derive(password.encode('utf-8'))
  ```

#### Fernet Master Key Wrapping & Field Encryption

1. **Fernet Key Generation:**
   `Fernet.generate_key()` produces 32 random bytes, URL-safe base64-encoded into a 44-character string (`crypto.py:26-28`).
2. **Key Wrapping (`crypto.py:30-35`):**
   ```python
   # Derived 32-byte master key is base64-urlsafe encoded to form a valid wrapping Fernet key:
   wrapping_key = base64.urlsafe_b64encode(master_key_bytes)
   f = Fernet(wrapping_key)
   wrapped_fernet = f.encrypt(fernet_key.encode('utf-8')).decode('utf-8')
   ```
   Stored in SQLite `app_settings` under key `wrapped_fernet`.
3. **Key Unwrapping (`crypto.py:37-41`):**
   ```python
   wrapping_key = base64.urlsafe_b64encode(master_key_bytes)
   f = Fernet(wrapping_key)
   fernet_key = f.decrypt(wrapped_fernet_key.encode('utf-8')).decode('utf-8')
   ```
4. **Credential Field Encryption/Decryption (`crypto.py:43-53`):**
   - **Cipher:** AES-128 in CBC mode with PKCS7 padding.
   - **Authentication:** HMAC-SHA256 authenticated envelope.
   - **Format:** `Version (0x80, 1B) || Timestamp (8B) || IV (16B) || Ciphertext (var) || HMAC (32B)`, URL-safe Base64 encoded.
   - Applied to `password_encrypted` in `emails` and `accounts` tables (`crud/nodes.py:34, 54`).
   - Decrypted exclusively on-demand in `/api/nodes/{type}/{id}/password` (`main.py:186`).

#### Key Lifecycle State Machine

```
┌─────────────────┐
│ Application Run │  Salt file exists on disk (lattice.salt)
└────────┬────────┘  Database file exists on disk (lattice.db)
         │
         ▼ User enters master password
┌─────────────────┐
│   derive_key    │  Derives 32-byte master key in memory
└────────┬────────┘
         │
         ├───────────────────────────────┐
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│ init_db(db_key) │             │ unwrap_fernet   │ Unwraps payload from app_settings
└─────────────────┘             └────────┬────────┘
  Opens SQLCipher connection             │
                                         ▼
                                ┌─────────────────┐
                                │ SessionManager  │ Holds Fernet key in Dict[token, key]
                                └────────┬────────┘
                                         │
        ┌────────────────────────────────┴───────────────────────────────┐
        ▼ User requests credential                                       ▼ Lock triggered
┌─────────────────────────┐                                    ┌───────────────────┐
│ decrypt_value(fernet)   │                                    │ lock_auth()       │
└─────────────────────────┘                                    └─────────┬─────────┘
  Returns plaintext string                                               │
                                       ┌─────────────────────────────────┴──────────────────┐
                                       ▼                                                    ▼
                             ┌───────────────────┐                                ┌───────────────────┐
                             │ del _sessions[tok]│                                │ database.close_db │
                             └───────────────────┘                                └───────────────────┘
                               Key purged from RAM                                  Engine pool disposed
```

---

## 3. Auth, Session & Unlock Flow

### 3.1 Session Lifecycle & Token Management

1. **Setup Phase (`POST /api/auth/setup`):**
   - Verified that `lattice.db` does not exist (`main.py:52`).
   - Writes new random 16-byte salt to `lattice.salt` (`main.py:56-57`).
   - Derives `db_key` via Argon2id, generates new `fernet_key`, wraps it with `db_key`.
   - Initializes database, writes `wrapped_fernet` and default `auto_lock_minutes="15"` to `app_settings`.
2. **Unlock Phase (`POST /api/auth/unlock`):**
   - Reads `lattice.salt` from disk.
   - Derives `db_key` from user-entered password and salt.
   - Calls `database.init_db(db_key.hex())`.
   - Queries `app_settings` for `wrapped_fernet`. If password is wrong, `crypto.unwrap_fernet_key()` raises an exception; backend catches this, executes `database.close_db()`, and returns HTTP 401 (`main.py:97-105`).
   - Generates a UUID4 session token (`session.py:12`), stores `self._sessions[token] = fernet_key`.
   - Returns `{"session_token": token, "expires_at": None}`.
3. **Session Verification (`main.py:40-46`):**
   - Protected endpoints require FastAPI dependency `fernet_key = Depends(get_fernet_key)`.
   - Expects HTTP request header `session-token: <uuid>`.
   - Looks up `session.session_manager.get_fernet_key(session_token)`. Returns HTTP 401 if missing or invalid.
4. **Auto-Lock & Manual Lock Phase:**
   - **Manual Lock:** Triggered by user clicking lock button in `TopBar.tsx:16`. Calls `POST /api/auth/lock`.
   - **Auto-Lock:** Triggered by `AutoLockTimer.tsx:15-20`. Tracks user activity across 5 DOM events (`mousedown`, `mousemove`, `keypress`, `scroll`, `touchstart`). If inactive for `autoLockMinutes * 60 * 1000`, calls `lockAuth()` and updates local store.
   - **Backend Cleanup (`main.py:109-114`):** Deletes token from `_sessions` and calls `database.close_db()` (`_engine.dispose()`).

### 3.2 Persistent Server Process Assumptions to Redesign for Tauri

In the current Python architecture, several components assume a long-running, stateful server daemon:

1. **In-Memory Session Store (`session.py:7`):**
   - Python stores sessions in an un-synchronized global dictionary: `self._sessions: Dict[str, str] = {}`.
   - In Tauri, there is no HTTP server and no external clients connecting over network sockets. Requests arrive via direct Tauri IPC invocations from the single local Webview.
   - *Tauri Model:* Session tokens can be replaced entirely by a managed thread-safe native state: `tauri::State<Mutex<SessionState>>` holding the decrypted Fernet key and active SQLCipher connection.
2. **Global Database Engine Singleton (`database.py:12-13`):**
   - Python relies on global mutable variables `_engine` and `_SessionLocal`.
   - In Tauri, connection state is held within Tauri application state (`AppHandle.manage()`).
3. **Frontend Inactivity Timer vs. OS Sleep / Webview Suspension:**
   - `AutoLockTimer.tsx` runs inside browser JavaScript via `window.setTimeout`.
   - In a desktop application, when the OS enters sleep or the webview window minimizes/loses focus, browsers often throttle or freeze JavaScript timers. A Tauri application can track native OS idle events or window focus events in Rust rather than relying solely on webview DOM event listeners.

---

## 4. Frontend-Side HTTP Assumptions

The frontend currently operates under the assumption of an external HTTP REST server running at `http://localhost:8000/api`.

### 4.1 Axios Configuration & Interceptors (`frontend/src/api/client.ts`)
- **Base URL:**
  ```typescript
  export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    headers: { 'Content-Type': 'application/json' },
  });
  ```
  *(Reference: `frontend/src/api/client.ts:4-9`)*
- **Header Injection:**
  ```typescript
  apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().sessionToken;
    if (token && config.headers) {
      config.headers['session-token'] = token;
    }
    return config;
  });
  ```
  *(Reference: `frontend/src/api/client.ts:11-17`)*

### 4.2 CORS Configuration (`backend/app/main.py:14-29`)
- Backend sets up `CORSMiddleware` with `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.
- In Tauri, webview IPC bypasses the browser network stack and CORS policies completely.

### 4.3 HTTP Status Code & Error Handling Assumptions

The frontend explicitly inspects Axios HTTP error responses:

1. **`UnlockScreen.tsx:37-41`:**
   ```typescript
   } catch (err: any) {
     setError(err.response?.data?.detail || 'Failed to unlock');
     if (err.response?.data?.detail === 'Already setup') {
       setSetup(true);
     }
   }
   ```
2. **`UnlockScreen.tsx:18-21`:**
   ```typescript
   checkStatus().catch(() => {
     // Assumes HTTP error means backend is uninitialized / locked
     setLoading(false);
   });
   ```
3. **`AutoLockTimer.tsx:17-18`:**
   Catches network/HTTP errors silently during auto-lock dispatches.
4. **`database.py:33` / `main.py`:**
   Raises `HTTPException(status_code=503, detail="Database locked")` or `HTTPException(status_code=401, detail="Invalid password")`.

*Tauri IPC Mapping:* In Tauri, commands do not return HTTP status codes (200, 400, 401, 404, 503). Tauri commands return a Rust `Result<T, E>`. When returning `Err(e)`, the client's `invoke()` promise rejects with the serialized error payload `e`.

### 4.4 Polling & Streaming
- **Zero WebSockets / SSE:** An audit of `frontend/src/` confirms there are no WebSockets, Server-Sent Events (SSE), or long-polling mechanisms.
- **Request/Response Pattern:** All interactions are pure unary request-response calls.

---

## 5. Filesystem & Path Assumptions

### 5.1 Hardcoded Backend Paths

| Path Identifier | Current Definition | Location | Target Location in Working Tree |
| :--- | :--- | :--- | :--- |
| **`DEFAULT_DB_PATH`** | `os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lattice.db")` | `backend/app/database.py:7` | `backend/lattice.db` |
| **`DB_PATH`** | `os.path.abspath(os.getenv("LATTICE_DB_PATH", DEFAULT_DB_PATH))` | `backend/app/database.py:8` | Defaults to `backend/lattice.db` unless overridden by environment variable |
| **`SALT_PATH`** | `os.path.join(os.path.dirname(os.path.dirname(__file__)), "lattice.salt")` | `backend/app/main.py:48` | `backend/lattice.salt` |

### 5.2 Desktop App Filesystem Requirements

- **The Problem:** In a packaged desktop application (Debian `.deb`, AppImage, Windows `.msi`, macOS `.app`), application binaries are installed in read-only directories (e.g. `/usr/lib/lattice/`, `C:\Program Files\Lattice\`, `/Applications/Lattice.app/`). Attempting to create or write `lattice.db` or `lattice.salt` relative to the executable path will fail with permission errors.
- **Tauri Path Resolver:** Tauri provides platform-compliant standard directories via its `PathResolver`:
  - **Linux:** `~/.local/share/com.lattice.app/`
  - **macOS:** `~/Library/Application Support/com.lattice.app/`
  - **Windows:** `C:\Users\<User>\AppData\Roaming\com.lattice.app\`
- **Database & Salt Co-location:** Both `lattice.db` and `lattice.salt` must reside within the resolved `app_data_dir`.

### 5.3 Export File Downloads (`frontend/src/components/graph/ExportModal.tsx`)
- **SVG Export (`ExportModal.tsx:90-95`):** Uses browser Blob download:
  ```typescript
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${fileName || 'lattice-export'}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  ```
- **PNG Export (`ExportModal.tsx:122-127`):** Uses Canvas `toDataURL` download via synthetic `<a download>` click.
- *Tauri Environment:* While synthetic `<a>` clicks work inside webviews (downloading to the OS default Downloads folder), Tauri provides native file save dialogs via `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` to let users choose their exact save destination.

---

## 6. Python Dependencies Without Obvious Rust Equivalents

Below is the complete inventory of all 26 packages from `backend/requirements.txt`, categorized by their migration path to Rust.

| Python Package | Version | Primary Role in Current Codebase | Rust Migration Category | Rust Ecosystem Mapping & Technical Notes |
| :--- | :--- | :--- | :---: | :--- |
| **`fastapi`** | `0.141.1` | REST API routing, request validation, dependency injection | Direct Swap | Replaced entirely by Tauri command handlers (`#[tauri::command]`). |
| **`starlette`** | `1.6.0` | Underlying ASGI framework for FastAPI | Direct Swap | Replaced by Tauri IPC. |
| **`uvicorn`** | `0.52.4` | ASGI HTTP server running on port 8000 | Direct Swap | Removed. Tauri embeds the webview directly; no external HTTP server needed. |
| **`pydantic`** | `2.13.4` | Data validation and JSON serialization | Direct Swap | Replaced by Rust `serde` and `serde_json` with derive macros (`Serialize`, `Deserialize`). |
| **`pydantic-settings`** | `2.15.0` | Environment settings parsing | Direct Swap | Replaced by standard Rust configuration crates (e.g. `config` or `dotenvy`). |
| **`pydantic_core`** | `2.46.4` | Rust-based serialization engine for Pydantic | Direct Swap | Native `serde`. |
| **`anyio`** | `4.14.2` | Asynchronous I/O event loop | Direct Swap | Replaced by `tokio` (Tauri runtime). |
| **`SQLAlchemy`** | `2.0.52` | Relational ORM, table metadata, query builder, migrations | Direct Swap | Replaced by `rusqlite` (with SQLCipher support) or `sqlx`. Rust query mapping is straightforward for the 5 existing tables. |
| **`sqlcipher3-binary`** | `0.6.0` | SQLite with 256-bit AES full-database encryption | **Complex Swap** | **Requires discussion.** In Rust, SQLCipher is typically integrated via the `rusqlite` crate with the `"bundled-sqlcipher"` feature flag. Compiling SQLCipher from source requires linking against OpenSSL or LibreSSL and building the bundled C amalgamation. Cross-compilation for multiple desktop targets (Windows MSVC, macOS universal, Linux) requires careful build-script (`build.rs`) configuration. |
| **`cryptography`** | `50.0.1` | Argon2id KDF & Fernet symmetric encryption | **Complex Swap** | **Requires discussion.**<br>1. *Argon2id:* Cleanly replaced by the standard `argon2` Rust crate.<br>2. *Fernet:* Fernet is an opinionated token format specified by Python's `cryptography` library (AES-128-CBC + PKCS7 + HMAC-SHA256 with 32-byte dual keys). If existing user databases containing `password_encrypted` and `wrapped_fernet` must be decrypted in Rust, the Rust implementation must match the Fernet token specification byte-for-byte. Crates like `fernet` or a custom AES-128-CBC + HMAC-SHA256 pipeline must be evaluated. |
| **`argon2-cffi`** | `25.1.0` | CFFI bindings for Argon2 | Direct Swap | Replaced by native Rust `argon2` crate. |
| **`argon2-cffi-bindings`**| `26.1.0` | Low-level C bindings for Argon2 | Direct Swap | Replaced by native Rust `argon2` crate. |
| **`alembic`** | `1.19.1` | Database schema migrations | **Design Consideration** | In Python, `database.py:41` actually uses raw SQL `ALTER TABLE ADD COLUMN tags JSON` rather than running Alembic migrations. In Rust, migrations can be handled via simple embedded SQL scripts with `rusqlite_migration` or `refinery`. |
| **`python-dotenv`** | `1.2.3` | Loads `.env` file | Direct Swap | Replaced by `dotenvy` crate (dev only). |
| **`cffi`** | `2.1.1` | Foreign function interface | Obsolete | Not needed in Rust. |
| **`pycparser`** | `3.0` | C parser for CFFI | Obsolete | Not needed in Rust. |
| **`greenlet`** | `3.5.5` | Coroutine library for SQLAlchemy async | Obsolete | Not needed in Rust. |
| **`h11`** | `0.16.0` | Pure-Python HTTP/1.1 protocol engine | Obsolete | Not needed in Rust. |
| **`click`** | `8.5.0` | Command line interface library | Obsolete | Not needed in Rust. |
| **`idna`** | `3.19` | Internationalized domain names in applications | Obsolete | Replaced by `idna` crate if URL parsing is needed. |
| **`Mako`** | `1.4.1` | Template library for Alembic | Obsolete | Not needed in Rust. |
| **`MarkupSafe`** | `3.0.3` | String escaping for Mako | Obsolete | Not needed in Rust. |
| **`typing_extensions`** | `4.16.0` | Python type hinting backports | Obsolete | Rust native type system. |
| **`typing-inspection`** | `0.4.4` | Runtime type inspection | Obsolete | Rust compile-time reflection / traits. |
| **`annotated-types`** | `0.8.0` | Metadata annotations for types | Obsolete | Rust type system. |
| **`annotated-doc`** | `0.0.5` | Docstring extractor | Obsolete | Standard Rust `///` doc comments. |

---

## 7. Dev & Build Tooling

### 7.1 Current Development Workflow

1. **Backend Process:**
   - Started via terminal in virtual environment:
     ```bash
     PYTHONPATH=./backend ./backend/venv/bin/uvicorn app.main:app --reload --port 8000
     ```
   - Auto-reloads on Python file modifications.
   - Listens on `http://127.0.0.1:8000`.
2. **Frontend Process:**
   - Started via terminal:
     ```bash
     npm --prefix frontend run dev
     ```
   - Vite development server runs on `http://localhost:5173`.
   - Connects to backend across `localhost:8000` via Axios.
3. **Testing Tooling:**
   - Backend: `PYTHONPATH=./backend ./backend/venv/bin/pytest backend/tests` (8 tests).
   - Frontend: `npm --prefix frontend test` (Vitest, 41 tests).
   - Type Checking & Build: `npm --prefix frontend run build` (`tsc -b && vite build`).

### 7.2 Tauri Workflow Replacement

In a Tauri setup, development and production packaging are unified under the Tauri CLI:

- **Configuration File:** `src-tauri/tauri.conf.json`
- **Development Command:**
  ```bash
  cargo tauri dev
  ```
  - Automatically executes `beforeDevCommand`: `npm run dev` (starts Vite on `localhost:5173`).
  - Sets `devUrl`: `http://localhost:5173`.
  - Spawns the native desktop window hosting the webview and compiles the Rust backend with auto-reload (`cargo watch` or Tauri's native file watcher).
- **Production Build Command:**
  ```bash
  cargo tauri build
  ```
  - Automatically executes `beforeBuildCommand`: `npm run build` (outputs to `frontend/dist/`).
  - Embeds `frontend/dist/` directly into the compiled native binary executable.
  - Generates platform-specific application installers:
    - Linux: `.deb`, `.AppImage`
    - macOS: `.dmg`, `.app`
    - Windows: `.msi`, `.exe`
- **Ports & Processes Eliminated:**
  - Port 8000 is removed.
  - Python virtual environment (`backend/venv/`) is removed.
  - Uvicorn and CORS network handling are removed.

---

## 8. LocalStorage & Browser-Only State

An audit of `frontend/src/` identified three distinct keys utilized in browser `localStorage`:

| `localStorage` Key | Reading / Writing Locations | Payload Schema | Functional Purpose | Overlap with SQLite Data Layer |
| :--- | :--- | :--- | :--- | :--- |
| **`node_positions`** | • `GraphCanvas.tsx:170, 323, 328, 340, 345, 603, 605, 638, 640`<br>• `AccountNode.tsx:90, 94`<br>• `EmailNode.tsx:92, 96`<br>• `PhoneNode.tsx:88, 92`<br>• `ServiceNode.tsx:90, 94` | `Record<string, { x: number, y: number }>`<br>*(Keyed by node UUID)* | Caches Cartesian coordinates for nodes so custom layout arrangements persist across page reloads and Dagre layout passes. | **CRITICAL ARCHITECTURAL OVERLAP ⚠️**<br>The node entities themselves (`emails`, `phones`, `services`, `accounts`) are persisted in SQLite, but their visual positions exist **strictly in browser localStorage**. If browser storage is cleared, webview profile is reset, or the database is copied to another device, all layout coordinates are permanently lost and nodes collapse to default coordinates `(0, 0)`.<br><br>*Migration consideration:* The SQLite schema currently lacks `position_x` and `position_y` columns. Unifying position storage into the database during the Rust migration would resolve this architectural split. |
| **`lattice-auth-storage`** | • `authStore.ts:28-33` (via Zustand `persist` middleware) | `{"state": {"isSetup": bool, "sessionToken": Optional[str]}, "version": 0}` | Persists setup flag and session token across browser refreshes to prevent returning to the setup screen. | **REDUNDANT OVERLAP ⚠️**<br>In a native desktop application with no HTTP boundary, storing `sessionToken` in localStorage is unnecessary. Whether the app is setup is already determined by whether `lattice.db` exists in `app_data_dir`, and session authentication is held directly in Rust application state. |
| **`ui-storage`** | • `uiStore.ts:28, 53` (via Zustand `persist` middleware) | `{"state": {"theme": "dark" \| "light"}, "version": 0}` | Preserves user interface theme selection across reloads. | **No SQLite Overlap.**<br>Purely presentational preference. Can safely remain in Webview localStorage or be synchronized with Tauri's native window theme API. |

---

*End of Tauri & Rust Backend Migration Audit.*
