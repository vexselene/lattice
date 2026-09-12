# Glossary

This document provides plain-language definitions for the core concepts and technologies used in the Lattice codebase. It is designed to be a quick reference for developers who are familiar with programming in general but may be new to this specific stack.

## AES-256-GCM
An authenticated symmetric encryption algorithm used in this codebase for **field-level encryption** (specifically, for encrypting the `password` and `notes` fields inside nodes). While SQLCipher encrypts the entire database file at rest, AES-256-GCM is used as an additional layer of defense-in-depth for the most sensitive individual fields. See `encrypt_field` and `decrypt_field` in `src-tauri/src/crypto.rs`.

## Argon2id
A modern, memory-hard key derivation function (KDF) used to transform a user's master password into a 32-byte cryptographic key. The "memory-hardness" (configured to use 64MB of RAM per attempt in `src-tauri/src/crypto.rs`) intentionally slows down the process and makes it prohibitively expensive for an attacker to use specialized hardware (like GPUs or ASICs) to brute-force guess the password.

## Concurrency Primitives (`std::sync::Mutex` vs `tokio::sync::Mutex`)
Rust provides different types of locks for different situations. This codebase uses a deliberate "split lock" pattern in `src-tauri/src/state.rs`:
- `std::sync::Mutex<AppState>`: A synchronous lock used for fast, immediate data access (like reading the active database connection). It is illegal to hold this lock across an `await` point.
- `tokio::sync::Mutex<()>` (used for `GLOBAL_UNLOCK_GATE`): An asynchronous lock that *can* be held across `await` points. It is used specifically to serialize password unlocking attempts. Because Argon2id is incredibly CPU-intensive, allowing concurrent unlock attempts could easily cause CPU thrashing or memory exhaustion (a denial-of-service). The `GLOBAL_UNLOCK_GATE` ensures only one heavy crypto operation happens at a time.

## Electron
A framework for building cross-platform desktop applications using web technologies.
- **Main Process**: Runs Node.js and manages native OS integrations (windows, dialogs, file system). See `electron/main.js`.
- **Renderer Process**: Runs the web frontend (React). By default, it is sandboxed and cannot access the underlying OS.
- **Preload Script**: A script that runs in the renderer process *before* the web page loads, but retains access to Node.js features (when sandboxing is disabled, as is the case here). It bridges the gap between the isolated frontend and native capabilities. See `electron/preload.js` where it exposes the native Rust addon to the React frontend via `contextBridge`.

## Framer Motion (`layoutId`)
A React animation library. This project specifically uses its `layoutId` feature (in `frontend/src/components/grid/CanvasGrid.tsx` and related components) to perform "shared layout animations." When a user clicks a canvas card in the grid, the card smoothly expands into the password unlock modal by animating between two distinct React components that share the same `layoutId`.

## napi-rs
A framework for building pre-compiled Node.js native addons using Rust. Instead of running a separate local backend server (like FastAPI) or using a slower IPC messaging system (like Tauri's `invoke()`), `napi-rs` compiles the Rust core into a binary library (`.node` file) that the Electron renderer's preload script can `require()` and call directly as synchronous or asynchronous JavaScript functions.

## React Flow
A library for building node-based graphical interfaces. It powers the interactive graph canvas (see `frontend/src/components/graph/GraphCanvas.tsx`), handling the rendering of nodes, edges, panning, zooming, and drag-and-drop interactions.

## Rust Basics
- **Ownership/Borrowing**: Rust's memory management model. Data has a single "owner." It can be temporarily "borrowed" by passing references (`&T` for read-only, `&mut T` for mutable). This is why `AppState` must be wrapped in a `Mutex`—to allow multiple threads to safely borrow and mutate the state.
- **`Result<T, E>` and `?`**: A type that represents either success (`Ok(T)`) or failure (`Err(E)`). The `?` operator is syntactic sugar that immediately returns the error if the result is an `Err`, acting like an implicit early return.
- **Traits**: Similar to interfaces in other languages. They define shared behavior. For example, the `#[napi]` macro automatically implements the necessary traits to expose a Rust function to Node.js.

## SQLite & SQLCipher
- **SQLite**: A lightweight, file-based relational database.
- **SQLCipher**: An open-source extension to SQLite that provides transparent, 256-bit AES whole-database encryption. This project uses it so that the graph topology (which node connects to which) is encrypted at rest, which was a core threat-model requirement. It uses `PRAGMA key` to unlock the database and `PRAGMA rekey` to change passwords.

## Zustand
A minimal state-management library for React. Instead of one massive global store (like traditional Redux), this project intentionally splits state by domain to prevent unnecessary re-renders and keep logic organized:
- `authStore.ts`: Manages the vault lock status and active canvas ID.
- `canvasStore.ts`: Manages the grid of available canvases and layout transitions.
- `graphStore.ts`: Manages the actual nodes, edges, and selection states inside the open canvas.
