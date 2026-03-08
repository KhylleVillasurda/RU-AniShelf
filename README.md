# RU: AniShelf

A desktop anime library manager built with **Tauri v2**, **Rust**, and **React**.  
Scan your local folders, fetch metadata automatically, track your watch status, and browse your collection — all offline.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running in Development](#running-in-development)
- [Building for Production](#building-for-production)
- [Environment & Configuration](#environment--configuration)
- [Recommended Tools](#recommended-tools)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Prerequisites

Install all of the following before cloning the repo. These are required for Tauri to build on Windows.

### 1. Node.js

- **Version:** 18 or higher (LTS recommended)
- Download: https://nodejs.org/en/download

Verify:

```bash
node -v
npm -v
```

### 2. Rust & Cargo

- Install via `rustup` (the official Rust toolchain manager)
- Download: https://rustup.rs

```bash
# Run the installer, then verify:
rustc --version
cargo --version
```

> ⚠️ After installing Rust on Windows, **restart your terminal** before continuing.

### 3. Microsoft C++ Build Tools

Rust on Windows requires the MSVC linker.

- Download **Build Tools for Visual Studio**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- In the installer, select **"Desktop development with C++"**
- Required components (auto-selected): MSVC compiler, Windows SDK

### 4. WebView2 Runtime

Tauri uses WebView2 to render the frontend on Windows.

- Most Windows 10/11 machines already have this installed
- If not: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Project Structure

```
ru-anishelf/
├── src/                  # React frontend
│   ├── components/       # Layout, Sidebar, Topbar, AnimeCard, etc.
│   ├── contexts/         # ThemeContext
│   ├── pages/            # LibraryPage, SettingsPage, ProfilePage, etc.
│   └── themes/           # cinematic.ts, cli.ts
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── main.rs       # Tauri app entry point & command registration
│   │   ├── db.rs         # SQLite database setup and queries
│   │   └── ...           # Other Rust modules
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri app configuration
├── public/               # Static assets
├── package.json          # Frontend dependencies & scripts
└── vite.config.ts        # Vite build config
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ru-anishelf.git
cd ru-anishelf
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install the Tauri CLI

```bash
npm install --save-dev @tauri-apps/cli
```

### 4. Install Rust dependencies (handled automatically)

Cargo will fetch all Rust crates on first build. No extra steps needed — just make sure you completed the Rust & Build Tools setup above.

---

## Running in Development

```bash
npm run tauri dev
```

This will:

1. Start the Vite dev server for the React frontend (hot-reload enabled)
2. Compile the Rust backend
3. Launch the Tauri desktop window

> First run will take a few minutes while Cargo compiles all Rust dependencies. Subsequent runs are much faster.

---

## Building for Production

```bash
npm run tauri build
```

Output is placed in:

```
src-tauri/target/release/bundle/
├── msi/          # Windows installer (.msi)
└── nsis/         # NSIS installer (.exe)
```

---

## Environment & Configuration

RU: AniShelf stores all user settings in a local SQLite database — no `.env` file is needed to run the app.

The database is created automatically on first launch at:

```
C:\Users\<YourName>\AppData\Roaming\ru-anishelf\anishelf.db
```

### Settings stored in the database

| Key               | Description                                     |
| ----------------- | ----------------------------------------------- |
| `theme`           | UI theme (`cinematic` or `cli`)                 |
| `player_path`     | Path to your external video player `.exe`       |
| `library_folder`  | Primary anime folder path                       |
| `metadata_source` | Metadata provider (`anilist`)                   |
| `card_size`       | Library card size (`small`, `medium`, `large`)  |
| `grid_layout`     | Grid density (`compact`, `comfortable`, `cozy`) |
| `kitsu_username`  | Kitsu account username for the Profile page     |

---

## Recommended Tools

These aren't required but will make development smoother:

| Tool                                  | Purpose                                       |
| ------------------------------------- | --------------------------------------------- |
| **VS Code**                           | Recommended editor                            |
| **rust-analyzer** (VS Code extension) | Rust intellisense & error checking            |
| **Tauri** (VS Code extension)         | Tauri-specific hints                          |
| **ESLint + Prettier**                 | Frontend code formatting                      |
| **DB Browser for SQLite**             | Inspect the local database during development |

---

## Troubleshooting

### `cargo` or `rustc` not found after installing Rust

Restart your terminal. If still not found, add Rust to your PATH manually:

```
%USERPROFILE%\.cargo\bin
```

### `error: linker 'link.exe' not found`

The Microsoft C++ Build Tools are missing or not installed correctly.  
Re-run the Visual Studio Build Tools installer and ensure **"Desktop development with C++"** is checked.

### WebView2 error on launch

Install the WebView2 Runtime from:  
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### `npm run tauri dev` fails on first run

Make sure you ran `npm install` first. If errors persist, try:

```bash
npm install
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

### App launches but shows blank screen

This usually means the Vite dev server hasn't started yet. Wait a few seconds — Tauri will automatically reload once it's ready.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test with `npm run tauri dev`
5. Submit a pull request with a clear description of what changed

Please keep Rust and TypeScript changes in separate commits where possible — it makes reviews easier.

---

_Built with [Tauri](https://tauri.app) · [React](https://react.dev) · [Rust](https://www.rust-lang.org)_
