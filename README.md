# Lattice

**Lattice** is a visual digital identity graph that maps how your digital self is connected. By treating your identity topology as a sensitive asset, Lattice operates entirely local-first, with no cloud sync, allowing you to trace recovery chains and understand dependencies across your accounts in a private, encrypted environment.

## Features

- **Local-first, encrypted identity graph.** Everything lives on your
  machine — no cloud sync, no account, no telemetry. The graph *topology*
  (which nodes connect to which) is treated as sensitive on its own, not
  just individual passwords.
- **Multiple independent vaults ("canvases").** Rather than one big
  database, you can create any number of separate graphs, each with its
  own name and its own password. Losing or sharing one canvas's password
  never exposes any other canvas.
- **Whole-database + field-level encryption.** Each canvas is a SQLCipher-
  encrypted SQLite file (so its entire contents, not just individual
  fields, are unreadable without the password), with certain sensitive
  fields (like stored passwords/notes) additionally encrypted at the field
  level.
- **Strong password-based key derivation.** Passwords are never stored —
  keys are derived fresh each time via Argon2id, deliberately tuned to be
  slow and memory-hard against brute-force/GPU attacks.
- **Brute-force protection.** Repeated wrong-password attempts (on the
  vault or any individual canvas) trigger an increasing delay, capped at
  30 seconds.
- **Visual, interactive node graph.** Emails, phone numbers, service
  accounts, and their relationships (which email resets which account,
  which phone receives 2FA for what, shared usernames, linked accounts)
  are laid out as a draggable, zoomable node graph rather than a flat list.
- **Export/import canvases as portable encrypted files.** Move a canvas
  between machines, or make a backup, via a single `.lattice` file — the
  export never decrypts anything, it's a straight copy of the encrypted
  data.
- **SVG/image export of the graph itself**, with options to export
  everything, only a selected sub-chain, or an isolated/dimmed view of a
  specific part of the graph — useful for documentation or sharing a
  redacted view.
- **Light/dark theme**, remembered across restarts.
- **Cross-platform desktop app** — Linux (AppImage/.deb), Windows
  (installer), and macOS (Apple Silicon; see note under Installing below).

## How to Use

### 1. First launch — setting your master password

On first launch, Lattice asks you to set a **master password**. This
protects the *vault* — the registry that lists your canvases by name. It
does **not** by itself unlock any individual canvas's contents; think of it
as the password to see your list of vaults, not the vaults themselves.

Once set, you'll enter this same password every time you reopen the app (or
whenever the auto-lock timer or the top bar's lock button locks you out).

### 2. The canvas grid

After unlocking the vault, you land on a grid of your canvases. Each canvas
is shown as a square card with a distinct color/pattern and a padlock icon
— the pattern is purely decorative (assigned per-canvas, not derived from
canvas contents) and exists so canvases are easy to tell apart at a glance.

- **Create a new canvas**: click the first tile in the grid (marked with a
  dashed border and a `+`). You'll be asked for a name and a password for
  this new canvas — this is a *separate* password from your master
  password.
- **Open a canvas**: click its card. It expands to fill the window and asks
  for that canvas's password. Entering the correct password opens the
  graph; clicking the back arrow (or pressing Escape) cancels without
  attempting to unlock anything.
- **Per-canvas options**: each card has a small menu button
  offering:
  - **Rename** — change the canvas's display name (names must be unique;
    you'll be asked to pick a different one if it collides with an
    existing canvas).
  - **Duplicate** — create a full copy under a new name. You'll need to
    enter the *original* canvas's password to do this; you can optionally
    set a different password for the new copy, or leave that blank to keep
    the same password as the original.
  - **Change Password** — re-key a canvas in place (same canvas, same
    data, new password). Requires the current password first.
  - **Export** — save the canvas as a `.lattice` file via your OS's normal
    save-file dialog. No password is needed for this step (the exported
    file is still fully encrypted — you'll need the canvas's password to
    ever open it again, whether that's on this machine or another one).
  - **Delete** — permanently remove a canvas. This requires re-entering
    that canvas's password as a confirmation step, since it can't be
    undone.
- **Import a canvas**: from the hamburger menu (top-right), choose **Import
  canvas** and pick a `.lattice` file. It's added to your grid under a new
  entry — if a canvas with the same name already exists, the import is
  automatically renamed (e.g. `"Name (imported)"`) so nothing gets
  overwritten or confused with an existing canvas.
- **Search**: the search icon in the top bar filters the grid by canvas
  name.
- **Sort order**: from the hamburger menu, choose **Sort by** to switch
  between **Recently Used** (most-recently-opened first) and **Manual**. In
  Manual mode, a pencil button appears bottom-right — tap it to enter
  rearranging mode (cards get a dashed border and a drag-handle icon as a
  visual cue; you can drag any card, not just the handle, to reorder it),
  then tap the same button (now shown as an ✕) to save your arrangement and
  exit.
- **Theme toggle**: sun/moon icon in the top bar switches between light and
  dark mode.
- **Lock button**: locks the *vault* entirely, returning you to the master
  password screen. This is different from closing an individual canvas
  (see below) — locking the vault requires the master password again to
  get back in, and clears any open canvas.

### 3. Inside a canvas — the graph

Once a canvas is open, you're looking at your identity graph.

- **Node types**: Email, Phone, Account, and Service. A Service (e.g. "the
  company behind an account") is shown as a small colored pill attached to
  its Account node rather than as its own separate node on the canvas.
- **Interacting with a node**: hovering reveals its connection points;
  single-clicking highlights the chain of nodes/edges connected to it;
  double-clicking opens an inline detail panel directly under the node,
  which has its own icon to open the full detail sidebar.
- **Creating connections**: drag from a node's connection handle to create
  a new, linked node — you'll be prompted for the relationship type
  (e.g. "this email is the recovery method for this account").
- **Double-clicking an edge** opens a small menu of actions for that
  specific connection.
- **Moving nodes around**: the canvas has a **View** mode and an **Edit**
  mode toggle
  - In **View** mode, dragging a node is exploratory/non-destructive —
    the new position is only visual, and clicking elsewhere on the canvas
    (or selecting a different node/edge) snaps it back to where it was
    last saved. Nothing is written to disk while just browsing.
  - In **Edit** mode, every drag is saved immediately.
  - Switching from View into Edit mode automatically saves whatever you'd
    moved while in View mode — so if you like where you dragged something,
    just flip into Edit mode rather than needing to drag it again.
- **Exporting the graph as an image**: opens an export dialog with options
  to export the whole graph or just a selected portion, and whether
  non-selected parts should be hidden entirely or just visually dimmed —
  useful if you want to share or document part of your graph without
  exposing the rest.
- **Closing a canvas**: use the back/close control in the canvas's own top
  bar to return to the vault. This does *not* lock
  the vault — it just closes this one canvas, and the master password is
  not required again unless you separately lock the vault or the auto-lock
  timer fires.
- **Auto-lock**: after a period of inactivity, the vault locks itself
  automatically for safety, same as manually clicking the lock button.

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

## Installing (pre-built releases)

Pre-built installers for Linux, Windows, and macOS are attached to each
[tagged release](../../releases). A couple of things worth knowing before
installing:

- Installers are **unsigned** (no code-signing certificate) — this is a
  personal, non-commercial project, so your OS will show a one-time
  "unknown publisher" warning on first launch. This is expected; there's
  no malware concern, just the absence of a paid signing certificate.
- **macOS**: builds currently target Apple Silicon (arm64). Intel Mac
  support is a known gap — if you're on an Intel Mac and
  the installer doesn't launch, that's why, not a corrupted download.

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