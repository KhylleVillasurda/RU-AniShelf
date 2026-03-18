# RU: AniShelf — Project Summary

## Overview

**RU: AniShelf** is a cross-platform desktop anime library manager that combines local file scanning with rich metadata enrichment from multiple anime databases. It enables users to organize their anime collection, track watch status, and discover detailed information about their series—all in a modern, themeable interface.

**Tech Stack:**
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons
- **Backend:** Rust + Tauri v2 (desktop framework)
- **Database:** SQLite (bundled, local-first)
- **Metadata Sources:** AniList (GraphQL), MyAnimeList (REST API), Kitsu (JSON:API)
- **Build Tools:** Vite, TypeScript compiler, Tauri CLI

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React/TS)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Pages: Library | SeriesDetail | History | Settings ...│   │
│  │ Components: AnimeCard | Modal | Sidebar | Topbar       │   │
│  │ Context: Theme (6 themes: Cinematic, CLI, Meadow, etc) │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│                    Tauri IPC Bridge (JSON)                       │
│                              ↓                                   │
├─────────────────────────────────────────────────────────────────┤
│                  Backend (Rust / Tauri v2)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   lib.rs     │  │   db.rs      │  │metadata.rs   │          │
│  │(Commands)    │  │(SQLite ORM)  │  │(API Clients) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ scanner.rs   │  │  kitsu.rs    │  │ (Settings)   │          │
│  │(FS Walking)  │  │(Metadata)    │  │(KV Store)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              ↓                                   │
│                    Local SQLite Database                         │
│                  (Covers, Series, Episodes, History)            │
└─────────────────────────────────────────────────────────────────┘
```

### Core Modules

| Module | Language | Purpose |
|--------|----------|---------|
| [lib.rs](src-tauri/src/lib.rs) | Rust | Tauri command layer—exposes all frontend-callable functions. Thin wrapper delegating to db/metadata modules. |
| [db.rs](src-tauri/src/db.rs) | Rust | SQLite schema & queries. Manages series, episodes, history, settings, library folders. |
| [metadata.rs](src-tauri/src/metadata.rs) | Rust | API clients for AniList, MAL, Kitsu. Fetches & normalizes anime metadata. HTML stripping & cover downloading. |
| [scanner.rs](src-tauri/src/scanner.rs) | Rust | Filesystem traversal. Detects season folders → episode files. Extracts episode numbers. |
| [kitsu.rs](src-tauri/src/kitsu.rs) | Rust | Specialized Kitsu API integration (may be merged into metadata.rs). |
| [App.tsx](src/App.tsx) | TypeScript/React | Main app shell. Manages page routing, global state, theme injection. |
| [ThemeContext.tsx](src/contexts/ThemeContext.tsx) | TypeScript/React | Theme provider. 6 selectable themes with CSS variable injection. |
| [Pages/*](src/pages/) | TypeScript/React | Page components: Library, SeriesDetail, History, Settings, Profile. |
| [Components/*](src/components/) | TypeScript/React | Reusable UI: AnimeCard, Modal windows, Sidebar, Topbar. |

---

## Key Features & Data Flow

### 1. **Library Scanning**

**Flow:** User selects folder → Scanner walks directory → Detects episodes → Database stores structure

- Scanner recursively walks selected folder looking for video files
- Organizes episodes by season (folder structure: `Series/Season X/Episode`)
- Extracts episode numbers from filenames
- Stores all episodes linked to a series in SQLite

**Relevant Code:** [scanner.rs](src-tauri/src/scanner.rs)

### 2. **Metadata Enrichment**

**Flow:** Series added → User picks source (AniList/MAL/Kitsu) → API fetched → Normalized & stored

- Supports three metadata sources with different APIs:
  - **AniList:** GraphQL API, SEARCH_MATCH sorting, best for accuracy
  - **MAL:** REST API, requires Client ID in settings, 5-result limit per query
  - **Kitsu:** Public JSON:API, no auth, sideloaded genre categories
- Normalizes scores (MAL 0-100 & Kitsu 0-100 → AniList 0-10 format)
- Extracts title variants (Romaji, English, Native), synopsis, genres, episode count, status, format
- Downloads covers locally to `%APPDATA%/ru-anishelf/covers/` and caches them

**Relevant Code:** [metadata.rs](src-tauri/src/metadata.rs)

### 3. **Watch History Tracking**

**Flow:** Episode played → Event logged to DB → History page displays timeline

- Each play triggers a `WatchEvent` record
- Stores: series name, episode number, filename, timestamp
- Can browse history by series or view full timeline
- History can be cleared (full or per-series)

**Relevant Code:** [db.rs](src-tauri/src/db.rs) — `log_watch_event()`, `get_watch_history()`

### 4. **Theme System**

**6 Built-in Themes:**
- `cinematic` — Dark, high contrast
- `cli` — Terminal-like aesthetic
- `everforestdark` — Forest green palette
- `meadow` — Light, nature-inspired
- `obsidian` — Deep blacks & grays
- `succubus` — Red & purple tones

Each theme defines CSS variables: `--accent`, `--bg-base`, `--bg-surface`, `--border-default`, etc. Injected at runtime into DOM.

**Relevant Code:** [themes/](src/themes/), [ThemeContext.tsx](src/contexts/ThemeContext.tsx)

### 5. **Series Status Tracking**

Status values: `watching` | `completed` | `on_hold` | `plan_to_watch` | `dropped`

Users can update series status from library view or detail page. Stored in SQLite `series` table.

---

## Database Schema (SQLite)

### Key Tables

**`series`**
```
id (INTEGER PK)
title (TEXT)
title_english, title_native (TEXT, nullable)
local_path (TEXT)
cover_local_path, cover_remote_url (TEXT, nullable)
synopsis (TEXT, nullable)
episode_count (INTEGER, nullable)
status (TEXT: watching|completed|etc)
anilist_id, anilist_score (INTEGER/REAL, nullable)
genres (TEXT: CSV or JSON array)
metadata_source (TEXT: "anilist"|"mal"|"kitsu")
created_at, updated_at (DATETIME)
```

**`episodes`**
```
id (INTEGER PK)
series_id (INTEGER FK → series.id)
episode_number (INTEGER)
file_path (TEXT)
file_name (TEXT)
season_name (TEXT)
```

**`watch_events`**
```
id (INTEGER PK)
series_name, episode_name (TEXT)
episode_number (INTEGER)
watched_at (DATETIME)
```

**`settings`**
```
key (TEXT PK)
value (TEXT)
```
Stores: MAL Client ID, theme preference, library folders, etc.

---

## Frontend Organization

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| LibraryPage | `/library` | Browse all series, filter by status, search, drag into metadata picker |
| SeriesDetailPage | `/detail/:seriesId` | View series info, episode list, metadata, update status |
| HistoryPage | `/history` | Timeline of watched episodes, grouped by series |
| SettingsPage | `/settings` | Configure MAL API, theme, library folders, clear data |
| ProfilePage | `/profile` | User stats, quick actions (maybe planned) |

### Component Structure

**Modal Windows** (used for metadata workflows):
- `AniListPickerModal` — Search AniList results, select metadata
- `MetadataEditModal` — Edit fetched metadata before saving
- `MetadataFieldPickerModal` — Pick which metadata source to use
- `ScanConfirmModal` — Review detected episodes before committing to DB

**Layout Components**:
- `Layout` — Wraps pages with Topbar + Sidebar
- `Topbar` — Search bar, settings icon
- `Sidebar` — Navigation, status filters
- `AnimeCard` — Series preview card (poster, title, status badge)
- `SkeletonCard` — Loading placeholder

### State Management

- **Theme:** Global context (`ThemeContext`)
- **Page Navigation:** Local state in `App.tsx`
- **Series Data:** Fetched on demand via Tauri commands
- **Form State:** Local to component (modals, filters)

No Redux/Zustand—kept minimal by design, leveraging Tauri for backend state.

---

## Tauri Command API

All commands defined in [lib.rs](src-tauri/src/lib.rs), callable from frontend via `@tauri-apps/api/core`.

### Key Commands

**Library Management**
- `add_library_folder(path: str)` → Adds folder to watched libraries
- `remove_library_folder(folder_id: i64)` → Removes folder from library
- `scan_library(folder_path: str)` → Triggers filesystem scan, returns detected episodes

**Series Operations**
- `get_series_list()` → All series with episode counts
- `get_series_detail(id: i64)` → Full series + episodes + metadata
- `update_series_status(id: i64, status: str)` → Updates watch status
- `save_series(metadata, cover_path)` → Saves newly scanned series to DB

**Metadata Fetching**
- `search_anilist(title: str)` → Returns array of AniList search results
- `search_mal(title: str)` → Returns array of MAL search results  
- `search_kitsu(title: str)` → Returns array of Kitsu search results
- `fetch_anilist_metadata(title: str)` → Single best-match result from AniList
- `download_cover(url: str, series_title: str)` → Downloads & caches cover locally

**Watch History**
- `log_watch_event(series_id: i64, episode_num: i32)` → Records a watch event
- `get_watch_history()` → Returns all watch events (paginated)
- `clear_watch_history(series_id?: i64)` → Clears all or per-series history

**Settings**
- `get_setting(key: str)` → Retrieves setting value
- `set_setting(key: str, value: str)` → Stores setting
- `get_mal_client_id()` → Retrieves MAL Client ID for API calls

---

## Development Workflow

### Running Locally

```bash
# Install dependencies (frontend + Rust)
npm install
cd src-tauri && cargo build

# Development server (auto-reload on file changes)
npm run dev

# Building for production
npm run build
```

### File Structure for Development

```
src/                 ← Frontend (React)
├── components/       ← UI components
├── pages/            ← Page components
├── contexts/         ← Global context (theme)
├── themes/           ← 6 theme definitions
├── assets/           ← Images, fonts
└── App.tsx           ← Main app shell

src-tauri/           ← Backend (Rust + Tauri)
├── src/
│   ├── lib.rs        ← Command exports
│   ├── db.rs         ← SQLite queries
│   ├── metadata.rs   ← API clients
│   ├── scanner.rs    ← Filesystem walking
│   └── main.rs       ← Entry point
├── Cargo.toml        ← Rust dependencies
└── tauri.conf.json   ← Tauri config
```

### Key Dependencies

**Frontend:**
- `react` 19 — UI framework
- `tailwindcss` 4 — Styling
- `lucide-react` — Icon library
- `@tauri-apps/api` — IPC to Tauri backend
- `recharts` — Charting (if used in history/stats)

**Backend:**
- `tauri` 2 — Desktop framework
- `rusqlite` (bundled) — SQLite driver
- `reqwest` + `tokio` — HTTP client for APIs
- `serde/serde_json` — Serialization
- `chrono` — Date/time handling
- `dirs` — Standard app directories

---

## Important Notes

### Offline-First Design
- All data stored locally in SQLite
- Metadata fetches happen on-demand with user confirmation
- Covers cached locally after first download
- No cloud sync—purely local collection management

### Error Handling
- API failures gracefully degrade (show cached data or error toast)
- Malformed episode filenames skip/log errors without crashing
- SQLite errors propagated to frontend as user-friendly messages

### Performance Considerations
- Large anime folders (1000+ episodes) may require pagination in list views
- Cover images cached to avoid repeated downloads
- GraphQL queries limited to 8 results per search (prevents timeout)

### Security & Privacy
- All data stays local on user's machine
- API calls to AniList/MAL/Kitsu include minimal metadata (title, genres, scores)
- SQLite database unencrypted (future enhancement: add encryption)

---

## Next Steps / Known Gaps

- Profile page implementation (stats, quick actions)
- Batch metadata updates (apply source change to multiple series)
- Episode progress tracking (not just watch events)
- Anime recommendation engine (based on tags/genres)
- Cloud sync / export (planned, not prioritized)

---

**Author:** Khylle Villasurda  
**Latest Update:** March 18, 2026  
**Version:** 0.1.0
