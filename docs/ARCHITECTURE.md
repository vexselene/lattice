# Lattice — Digital Identity Graph Manager
## System Architecture Blueprint

### 0. Stack Decision Log
- **KDF**: Argon2id for master password key derivation.
- **Backend**: FastAPI, SQLAlchemy, SQLCipher (via `sqlcipher3`), Pydantic.
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Lucide React + `@xyflow/react` (React Flow v12).
- **Encryption Model**: Two-tier (SQLCipher database-level encryption at rest + Fernet application-level field encryption for passwords).

---

### 1. Database Schema
-- ============ NODES ============

CREATE TABLE emails (
    id              TEXT PRIMARY KEY,
    address         TEXT NOT NULL UNIQUE,
    provider        TEXT,
    password_encrypted TEXT,
    notes           TEXT,
    tags            JSON,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_emails_address ON emails(address);

CREATE TABLE phones (
    id              TEXT PRIMARY KEY,
    number          TEXT NOT NULL UNIQUE,
    carrier         TEXT,
    notes           TEXT,
    tags            JSON,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_phones_number ON phones(number);

CREATE TABLE services (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    url             TEXT,
    category        TEXT,
    icon_url        TEXT,
    notes           TEXT,
    tags            JSON,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_services_name ON services(name);

CREATE TABLE accounts (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    password_encrypted TEXT,
    service_id      TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    primary_email_id TEXT REFERENCES emails(id) ON DELETE SET NULL,
    notes           TEXT,
    tags            JSON,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_accounts_service ON accounts(service_id);
CREATE INDEX idx_accounts_email ON accounts(primary_email_id);
CREATE INDEX idx_accounts_username ON accounts(username);

-- ============ EDGES ============
-- Generic polymorphic edge table (source_type + source_id -> target_type + target_id)

CREATE TABLE edges (
    id              TEXT PRIMARY KEY,
    source_type     TEXT NOT NULL CHECK (source_type IN ('email','account','service','phone')),
    source_id       TEXT NOT NULL,
    target_type     TEXT NOT NULL CHECK (target_type IN ('email','account','service','phone')),
    target_id       TEXT NOT NULL,
    relation        TEXT NOT NULL CHECK (relation IN ('registered_with','recovery_for','uses_username','linked_account')),
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_edges_source ON edges(source_type, source_id);
CREATE INDEX idx_edges_target ON edges(target_type, target_id);
CREATE INDEX idx_edges_relation ON edges(relation);

-- ============ AUTH / SETTINGS ============

CREATE TABLE app_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

#### Application Rules:

* Direct foreign keys (`accounts.service_id`, `accounts.primary_email_id`) rely on DB cascades.
* Polymorphic relations in `edges` **must** be cleaned up manually at the application layer inside `crud/nodes.py` whenever an email, phone, service, or account node is deleted.
* All timestamps must be stored in UTC.

---

### 2. REST API Endpoints (Base: `http://localhost:8000/api`)

* `POST /auth/setup` — `{ master_password }` -> `{ success }`
* `POST /auth/unlock` — `{ master_password }` -> `{ session_token, expires_at }`
* `POST /auth/lock` -> `{ success }`
* `GET /auth/status` -> `{ unlocked: bool, auto_lock_minutes }`
* `PATCH /auth/settings` — `{ auto_lock_minutes }` -> `{ success }`
* `GET /nodes/{type}` (query: `?limit&offset`)
* `GET /nodes/{type}/{id}`
* `POST /nodes/{type}`
* `PUT /nodes/{type}/{id}`
* `DELETE /nodes/{type}/{id}` (Cleans up orphaned edges)
* `GET /nodes/{type}/{id}/password` (Decrypts on-demand using in-memory Fernet key)
* `GET /edges` (query: `?node_type&node_id`)
* `POST /edges`
* `PUT /edges/{id}`
* `DELETE /edges/{id}`
* `GET /graph` (Full graph ready for React Flow)
* `GET /graph/subgraph/{type}/{id}` (query: `?depth=1`)
* `GET /search` (query: `?q&types[]`)
* `POST /utils/generate-password`

---

### 3. Encryption Flow

1. **Setup**: Master password derives a 256-bit DB key via Argon2id. A random Fernet key is generated, wrapped (encrypted) with the derived Argon2id key, and stored in `app_settings`.
2. **Unlock**: Argon2id validates master password, opens the SQLCipher database, unwraps the Fernet key, and holds it in backend process memory mapped to an ephemeral `session_token`.
3. **Lock**: In-memory Fernet key is purged, database session closed, and token invalidated.

---

### 4. UI & Design System
- **Themes**: Dark theme (`#0f172a` canvas background) and Light theme (`#f8fafc` canvas background).
- **Node Colors**: Email=`#6366f1` (indigo), Account=`#a855f7` (purple), Service=`#10b981` (emerald), Phone=`#f97316` (orange).
- **Node Style**: Compact rounded pills (`rounded-full py-1.5 px-3`) with expandable bottom accordion trays. Connection handles (`<Handle>`) are anchored directly to the fixed-height pill container to prevent edge curve displacement during accordion expansion.
- **Edges**: Cubic Bezier curves (`GlowEdge`) with animated dashed strokes for active chains, theme-aware highlight colors (`#818cf8` dark, `#1d1764` light), and glow drop-shadow filters on hover/highlight.
- **Offline Vector Export**: Headless vector SVG serializer (`exportRenderer.ts`) rendering hookless static pill components (`*Export.tsx`) via `ReactDOMServer.renderToStaticMarkup` with zero live canvas DOM mutation.