# Lattice

**Lattice** is a visual digital identity graph that maps how your digital self is connected. By treating your identity topology as a sensitive asset, Lattice operates entirely local-first, with no cloud sync, allowing you to trace recovery chains and understand dependencies across your accounts in a private, encrypted environment.

## Quick Start (Development)

Lattice requires Node.js (v20+) and Rust to build.

1. **Install Dependencies**
   ```bash
   npm ci
   npm --prefix frontend ci
   ```

2. **Build the Application**
   ```bash
   # Build the Rust native addon (napi-rs)
   npm run build:native

   # Build the React frontend
   npm run build:frontend
   ```

3. **Run in Development Mode**
   ```bash
   npm start
   ```

## Project History & Architecture

This project has evolved through three distinct architectures, all preserved for historical reference:
1. **[archive/python-backend](https://github.com/vexselene/lattice/tree/archive/python-backend)**: The original implementation using Python/FastAPI and a standard REST architecture.
2. **[feat/tauri-rust-migration](https://github.com/vexselene/lattice/tree/feat/tauri-rust-migration)**: A migration to Tauri and Rust to enable a single-binary desktop app, which suffered from Linux WebKitGTK bugs.
3. **main (Current)**: The stable architecture using Electron, React, and a Rust core exposed directly via `napi-rs`. It features a multi-canvas vault system protected by Argon2id and SQLCipher.

For a deeper dive into the current codebase, please refer to:
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: A detailed technical breakdown of the storage model, encryption, request flows, and UI state.
- **[GLOSSARY.md](docs/GLOSSARY.md)**: Plain-language definitions for the core libraries and cryptographic primitives used in the project.

## CI/CD and Releases

Lattice uses GitHub Actions (`.github/workflows/build.yml`) to automatically compile installers for Linux, macOS, and Windows.
- **Builds**: Every push to `main` triggers a build to verify compilation across all three OS matrices.
- **Releases**: Pushing a version tag (e.g., `v1.0.0`) triggers the `release` job, which automatically attaches the `.exe`, `.dmg`, and `.AppImage` artifacts to a permanent GitHub Release.
