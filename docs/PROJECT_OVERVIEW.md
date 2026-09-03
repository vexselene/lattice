# Lattice — Project Overview

## 1. Project Directory & File Tree

```text
.
├── ARCHITECTURE.md                      # System design specification & database blueprint
├── GEMINI.md                            # Operational constraints & environment rules
├── PROJECT_OVERVIEW.md                  # Comprehensive architectural overview (this file)
├── PROJECT_AUDIT.MD                     # Codebase audit & system health assessment
├── README.md                            # Project setup and usage documentation
├── future-scope.txt                     # Roadmap and planned canvas enhancements
│
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── auth
│   │   │   ├── __init__.py
│   │   │   ├── crypto.py                # Argon2id KDF, Fernet key generation, wrapping & value encryption
│   │   │   └── session.py               # In-memory session manager mapping session tokens to Fernet keys
│   │   ├── crud
│   │   │   ├── __init__.py
│   │   │   ├── edges.py                 # Polymorphic edge CRUD & query operations
│   │   │   └── nodes.py                 # Node CRUD with password auto-encryption & orphaned edge cascades
│   │   ├── database.py                  # SQLCipher DB initialization, SessionLocal factory, and tag migration
│   │   ├── main.py                      # FastAPI application routes, dependencies, CORS & error handling
│   │   ├── models
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  # SQLAlchemy declarative Base
│   │   │   ├── edge.py                  # Polymorphic Edge model with CheckConstraints and compound indices
│   │   │   └── node.py                  # EmailNode, PhoneNode, ServiceNode, AccountNode & AppSetting models
│   │   └── schemas.py                   # Pydantic validation schemas for auth, nodes, and edges
│   ├── requirements.txt                 # Backend Python package dependencies
│   ├── tests
│   │   ├── test_crud.py                 # Unit tests for node/edge CRUD and cascade cleanup
│   │   └── test_crypto.py               # Unit tests for Argon2id KDF, Fernet wrapping & encryption
│   └── venv/                            # Isolated Python virtual environment
│
└── frontend
    ├── eslint.config.js                 # ESLint flat configuration
    ├── index.html                       # HTML application shell
    ├── package.json                     # Frontend dependencies & npm scripts
    ├── package-lock.json
    ├── postcss.config.js                # PostCSS / Tailwind CSS configuration
    ├── tailwind.config.js               # Tailwind design tokens & utility classes
    ├── tsconfig.json                    # Root TypeScript configuration
    ├── tsconfig.app.json                # Frontend application TS configuration
    ├── tsconfig.node.json               # Vite/Node TS configuration
    ├── vite.config.ts                   # Vite build & plugin configuration
    └── src
        ├── App.css                      # Global layout styles
        ├── App.tsx                      # Top-level scaffold, auth gate, graph hydration & layout wrappers
        ├── index.css                    # Tailwind CSS base imports & canvas utility classes
        ├── main.tsx                     # React root mount entry point
        ├── vite-env.d.ts                # Vite client environment type declarations
        │
        ├── api
        │   ├── auth.ts                  # Auth API client (setup, unlock, lock, status, settings)
        │   ├── client.ts                # Axios instance with request interceptor injecting session-token
        │   ├── edges.ts                 # Edge API client (fetch, create, update, delete)
        │   ├── nodes.ts                 # Node API client (fetch, create, update, delete, get password)
        │   └── search.ts                # Global node & relation search API client
        │
        ├── components
        │   ├── auth
        │   │   ├── AutoLockTimer.tsx    # Idle inactivity monitor triggering auto-lock
        │   │   └── UnlockScreen.tsx     # Master password unlock & initial database setup screen
        │   ├── forms
        │   │   ├── EdgeForm.tsx         # Modal form for creating & editing graph edges
        │   │   └── NodeForm.tsx         # Reusable modal form for creating standalone nodes
        │   ├── graph
        │   │   ├── ExportModal.tsx      # Vector SVG / PNG export preview modal with live configuration
        │   │   ├── GraphCanvas.tsx      # Core React Flow graph controller, events & drag-and-drop
        │   │   ├── GraphControls.tsx    # Floating zoom, fit-view, layout & export toolbar
        │   │   ├── SelectionActionDock.tsx # Floating multi-node action dock (batch delete, tags, copy)
        │   │   ├── edges
        │   │   │   └── GlowEdge.tsx     # Custom SVG edge with Bezier path, arrow markers & glow filters
        │   │   └── nodes
        │   │       ├── AccountNode.tsx  # Live Account node with inline password viewer & edit tray
        │   │       ├── AccountNodeExport.tsx # Pure static export pill component for Account nodes
        │   │       ├── EmailNode.tsx    # Live Email node with inline edit tray & anchor handles
        │   │       ├── EmailNodeExport.tsx   # Pure static export pill component for Email nodes
        │   │       ├── PhoneNode.tsx    # Live Phone node with inline edit tray & anchor handles
        │   │       ├── PhoneNodeExport.tsx   # Pure static export pill component for Phone nodes
        │   │       ├── ServiceNode.tsx  # Live Service node with inline edit tray & anchor handles
        │   │       └── ServiceNodeExport.tsx # Pure static export pill component for Service nodes
        │   ├── layout
        │   │   ├── SearchBar.tsx        # Omnibar search input with debounced API queries
        │   │   ├── TopBar.tsx           # Global header with theme toggle, edit mode toggle & lock button
        │   │   └── TypeFilterChips.tsx  # Node type filter chips (Email, Account, Service, Phone)
        │   ├── shared
        │   │   ├── ConfirmDialog.tsx    # Modal confirmation dialog for destructive actions
        │   │   ├── CopyFieldButton.tsx  # Hover-activated clipboard copy button
        │   │   └── PasswordGenerator.tsx# Password generator popup with entropy options
        │   └── sidebar
        │       ├── ConnectionsList.tsx  # Connected edges inspector for the selected node
        │       ├── EdgeEditor.tsx       # Edge metadata and relation modifier panel
        │       ├── NodeDetailPanel.tsx  # Right-side drawer for inspecting & editing selected node details
        │       └── PasswordField.tsx    # Password reveal field with on-demand decryption
        │
        ├── config
        │   └── graphStyleConfig.ts      # Central visual design tokens (colors, stroke widths, rings, glows)
        │
        ├── hooks
        │   ├── useGraphLayout.ts        # Dagre-based hierarchical graph layout calculator
        │   ├── useVisualState.ts        # Unified visual state hook computing opacity, rings, and dimming
        │   └── useVisualState.test.ts   # Unit tests for visual state calculation
        │
        ├── lib
        │   ├── focusState.ts            # Single ground-truth focus resolution for 4 interaction triggers
        │   ├── focusState.test.ts       # Unit tests for focusState resolution
        │   ├── exportSelection.ts       # Export inclusion and emphasis computation (all, dimmed, isolated)
        │   ├── exportSelection.test.ts  # Unit tests for export selection logic
        │   ├── exportRenderer.ts        # Offline headless SVG renderer with 100% live canvas parity
        │   └── exportRenderer.test.ts   # Unit tests for SVG generator and all 9 style matrix combinations
        │
        ├── stores
        │   ├── authStore.ts             # Zustand store for auth state, session token, and lock status
        │   ├── graphStore.ts            # Zustand store for nodes, edges, activeChain, selections & signals
        │   └── uiStore.ts               # Zustand store for theme, search query, type filters, and edit mode
        │
        ├── types
        │   └── graph.ts                 # Unified TypeScript interfaces for nodes, edges, and graph payloads
        │
        └── utils
            └── exportCanvas.ts          # Legacy DOM rasterizer utility
```

**Total Tracked Source Files:** ~75 files

---

## 2. File-by-File Summary

### Documentation & Operational Guidelines
- **`ARCHITECTURE.md`**: Core system architecture blueprint, database schemas, foreign keys, REST API routes, and cryptographic models.
- **`GEMINI.md`**: Environment constraints, strict virtualenv paths (`./backend/venv/`), and agent development rules.
- **`PROJECT_AUDIT.MD`**: Exhaustive technical audit, scorecard, security evaluation, and prioritized remediation roadmap.
- **`future-scope.txt`**: Canvas roadmap notes for floating controls and label filtering.

### Backend (`backend/app/`)
#### Core & Routing
- **`main.py`**: FastAPI application entry point, route bindings, CORS middleware, security dependencies (`get_db`, `get_fernet_key`), and graph aggregation endpoints.
- **`database.py`**: SQLCipher encrypted SQLite initialization (`sqlite+pysqlcipher`), scoped session factory (`get_db`), engine lifecycle management, and automatic `tags JSON` schema migration.
- **`schemas.py`**: Pydantic validation models for authentication, node creation/updates, and edge relations.

#### Data Models & CRUD
- **`models/base.py`**: SQLAlchemy DeclarativeBase base class.
- **`models/node.py`**: ORM definitions for `EmailNode`, `PhoneNode`, `ServiceNode`, `AccountNode`, and `AppSetting`. Configures UUID keys, UTC timestamps, JSON tags, and cascade foreign keys (`accounts.service_id` $\rightarrow$ `services.id`, `accounts.primary_email_id` $\rightarrow$ `emails.id`).
- **`models/edge.py`**: Polymorphic ORM `Edge` model with SQL `CheckConstraint`s on valid types and relations, alongside composite indexes.
- **`crud/nodes.py`**: Node persistence logic. Encrypts passwords via Fernet on create/update and automatically cascades deletions to all connected polymorphic edges in `edges`.
- **`crud/edges.py`**: Edge persistence and query abstractions by node type and ID.

#### Authentication & Cryptography
- **`auth/crypto.py`**: Argon2id KDF key derivation (64 MB memory cost, 3 iterations, 4 lanes), Fernet key wrapping (`wrapped_fernet` in `app_settings`), and authenticated value encryption/decryption.
- **`auth/session.py`**: Ephemeral in-memory session store mapping generated UUID4 tokens to active Fernet keys.

---

### Frontend (`frontend/src/`)

#### Core, Styles & Types
- **`main.tsx`**: Application bootstrap entry point with React StrictMode.
- **`App.tsx`**: Application layout orchestrator; manages authentication gates, graph data hydration, and renders `<UnlockScreen />` vs `<TopBar />`, `<GraphCanvas />`, `<NodeDetailPanel />`, and `<ExportModal />`.
- **`config/graphStyleConfig.ts`**: Single source of truth for visual tokens across both live canvas and SVG export:
  - Node colors and ring borders for `email`, `account`, `service`, `phone` in light/dark themes.
  - Edge stroke colors (`#818cf8` in dark mode, high-contrast `#1d1764` in light mode, `#47556998` for dimmed).
  - Opacity and blur tokens (`0.3` opacity, `0.5px` blur for bokeh dimming).
- **`types/graph.ts`**: Unified TypeScript interfaces for nodes, polymorphic edges, and API payloads.

#### Global State Management (Zustand)
- **`stores/authStore.ts`**: Tracks setup status, session unlock state, session token, and inactivity auto-lock duration.
- **`stores/graphStore.ts`**: Central state for nodes, edges, selections (`selectedNodeIds`, `selectedEdgeIds`), active focus chains (`activeChain`), multi-select modes (`activeMultiMode`: `'none' | 'isolate' | 'chains'`), and batch tag operations.
- **`stores/uiStore.ts`**: Tracks theme (`dark` / `light`), search query, type filter chips, and edit mode toggle.

#### Focus & Visual State Engine
- **`lib/focusState.ts`**: Unified focus resolution engine defining the single source of truth for active elements across the live canvas and SVG export:
  - **Trigger 1 (Single Node Click):** Root = clicked node, Neighbors = 1-hop activeChain nodes, Neighbor Edges = activeChain edges.
  - **Trigger 2 (Edge Click):** Root Edges = selected edges, Neighbor Nodes = connected endpoint nodes.
  - **Trigger 3 (Multi-Select):** Root Nodes = selected nodes, no expansion.
  - **Trigger 4 (Chains Multi-Select):** Root Nodes = selected nodes, Neighbors = compound 1-hop expansion, Neighbor Edges = connecting edges.
- **`hooks/useVisualState.ts`**: Consumes `getFocusState()` to compute opacity, blur filters, and ring classes for nodes and edges during live rendering.

#### Export Pipeline (Offline Vector Engine)
- **`lib/exportSelection.ts`**: Resolves included entities and emphasis sets for export modes (`all`, `dimmed`, `isolated`).
- **`lib/exportRenderer.ts`**: Headless, DOM-free vector SVG serializer:
  - Renders nodes using pure `*Export.tsx` components via `ReactDOMServer.renderToStaticMarkup`.
  - Calculates Bezier edge paths, embeds typography (`Inter`), and renders background grid patterns.
  - Supports granular controls: `ringScope` (`all | selected | none`), `edgeStyle` (`normal | dashed | highlighted`), and `edgeStyleApplyTo` (`all | selected | nonSelected`).
  - Ensures 100% visual parity with live canvas for dashed edges (2.5px width, `#818cf8`/`#1d1764` stroke, dynamic arrow markers).
- **`components/graph/ExportModal.tsx`**: Live export configuration modal featuring synchronous SVG vector preview, format toggle (SVG/PNG), resolution scale (1x, 2x, 3x), and paired edge/ring controls.

#### Custom Node Components (Live vs. Export Separation)
- **`components/graph/nodes/EmailNode.tsx`, `AccountNode.tsx`, `PhoneNode.tsx`, `ServiceNode.tsx`**:
  Interactive React Flow canvas nodes. Feature expandable inline edit trays, password reveal trays, tag chips, and embedded handles. All hooks execute unconditionally at the top level adhering to React Rules of Hooks.
- **`components/graph/nodes/EmailNodeExport.tsx`, `AccountNodeExport.tsx`, `PhoneNodeExport.tsx`, `ServiceNodeExport.tsx`**:
  Pure static, hookless presentational components used for headless SVG generation. Render self-contained inline-styled SVG markup with zero runtime dependencies.

#### Graph Layout & Interactive Forms
- **`components/graph/GraphCanvas.tsx`**: Core React Flow controller managing viewport transforms, multi-selection gestures, edge drop connections (`onConnectEnd`), and contextual menus.
- **`components/graph/edges/GlowEdge.tsx`**: Custom SVG edge path renderer with animated dashed strokes for active chains and theme-aware glow filters.
- **`components/graph/SelectionActionDock.tsx`**: Floating dock for multi-node operations (batch delete, batch tag addition, copy identifiers, quick export).
- **`components/sidebar/NodeDetailPanel.tsx`, `PasswordField.tsx`, `ConnectionsList.tsx`**: Right-side drawer for deep node inspection, editing, and on-demand credential decryption.
- **`hooks/useGraphLayout.ts`**: Wraps Dagre.js to compute automatic hierarchical tree layouts.

---

## 3. Execution Flow & Architecture

### 3.1 Authentication & Two-Tier Cryptography Flow

```
User Master Password
        │
        ▼  Argon2id KDF (Salt: 16B, Memory: 64MB, Iterations: 3, Lanes: 4)
┌────────────────────────────────────────────────────────┐
│ 256-bit Derived Database Key                           │
├───────────────────────────┬────────────────────────────┤
│ Opens SQLCipher Database  │ Unwraps Fernet Master Key  │
│ (Encryption-at-Rest)      │ (Stored in app_settings)   │
└───────────────────────────┴────────────────────────────┘
                                          │
                                          ▼ Ephemeral Session Token (RAM only)
                            ┌────────────────────────────┐
                            │ In-Memory Fernet Key       │
                            │ (On-Demand Credential Enc) │
                            └────────────────────────────┘
```

1. **Setup:** Master password derives a 256-bit key via Argon2id. A random Fernet key is generated, encrypted with the derived key, and stored in `app_settings` as `wrapped_fernet`.
2. **Unlock:** Argon2id validates the password, opens SQLCipher SQLite, unwraps the Fernet key into `SessionManager` memory, and issues a session token.
3. **Password Access:** Requests to `/api/nodes/{type}/{id}/password` decrypt credential values on-demand using the in-memory Fernet key without ever exposing plaintext credentials at rest.
4. **Lock:** The session token and decrypted Fernet key are immediately purged from backend process memory, and database connections are closed.

### 3.2 Focus & Visual State Architecture

```
User Interaction (Node Click, Edge Click, Multi-Select, Box Select)
        │
        ▼
useGraphStore (activeChain, selectedNodeIds, selectedEdgeIds, activeMultiMode)
        │
        ▼
focusState.ts :: getFocusState()
  ├─ rootNodeIds       : Set<string>
  ├─ rootEdgeIds       : Set<string>
  ├─ neighborNodeIds   : Set<string>
  ├─ neighborEdgeIds   : Set<string>
  └─ hasActiveFocus    : boolean
        │
        ├────────────────────────────────────┐
        ▼                                    ▼
useVisualState.ts (Live Canvas)      exportRenderer.ts (Offline Vector SVG)
  • Computes opacity & bokeh blurs     • Filters nodes/edges by mode
  • Injects dynamic highlight rings    • Applies ringScope & edgeStyle rules
  • Activates dashed edge animations   • Renders static *Export components
```

### 3.3 Offline Standalone Vector Export Engine

Unlike traditional canvas rasterizers that capture the browser DOM using `html-to-image` (which introduces blur distortion, canvas state mutations, and font inconsistencies), Lattice implements a completely headless vector export pipeline:
1. **Zero Canvas Mutation:** Generates SVG strings entirely in memory via `ReactDOMServer.renderToStaticMarkup` without modifying live React Flow nodes, viewport coordinates, or component states.
2. **Independent Font & Pattern Embedding:** Injects standalone Google Fonts (`Inter`), grid background `<pattern>` definitions, and dynamic SVG arrow `<marker>` defs.
3. **Exact Visual Parity:** Dashed edges render with identical 2.5px stroke width, theme-aware highlight colors (`#818cf8` in dark mode, `#1d1764` in light mode), and matching markers.
4. **Dual Output Support:** Exports clean, infinite-resolution standalone SVG files or high-DPI rasterized PNGs (1x, 2x, 3x) via off-screen HTML5 `<canvas>` rasterization.

---

## 4. Known Edge Cases & Styling Patterns

### 4.1 React Rules of Hooks Compliance
- Custom nodes strictly separate live interactive logic from static export rendering:
  - Interactive nodes (`EmailNode.tsx`, `AccountNode.tsx`, etc.) execute all React hooks unconditionally at the top level.
  - Static export nodes (`EmailNodeExport.tsx`, `AccountNodeExport.tsx`, etc.) contain zero hooks and render pure inline-styled markup.
  - This eliminates hook order mismatch errors across both live canvas interactions and headless server-side export generation.

### 4.2 WebKit Backdrop Filter Compositing & Bokeh Dimming
- Nested CSS filters (`filter: blur(...)`) on parent wrappers envelope elements relying on background backdrops (`backdrop-filter: blur(...)`) cause visual rendering artifacts in WebKit/Blink.
- To maintain high frame-rate focus shifts without triggering browser compositing bugs:
  - Dimmed nodes apply strict bokeh styles: `opacity: 0.3; filter: blur(0.5px) grayscale(30%);`.
  - Focused nodes render crisp with zero filter blur and dynamic colored highlight rings.

### 4.3 Static Pill Anchor Handles
- React Flow `<Handle>` elements (`Target=Left`, `Source=Right`) are anchored inside the fixed-height "Pill" header container rather than the outer wrapper.
- When an inline tray expands downward to show credentials or edit inputs, the connection endpoints remain perfectly locked in place without tearing edge geometry.

---

*Lattice System Architecture & Codebase Overview — All Rights Reserved.*
