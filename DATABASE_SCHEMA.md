# RU: AniShelf — Database Schema Reference

Complete SQLite schema documentation with table definitions, relationships, constraints, and practical usage examples.

**Database Location:**
- Windows: `%APPDATA%\ru-anishelf\anishelf.db`
- Linux: `~/.local/share/ru-anishelf/anishelf.db`
- macOS: `~/Library/Application Support/ru-anishelf/anishelf.db`

---

## Table of Contents

1. [Quick Overview](#quick-overview)
2. [Core Tables](#core-tables)
3. [Junction & Reference Tables](#junction--reference-tables)
4. [Configuration Tables](#configuration-tables)
5. [Schema Diagram](#schema-diagram)
6. [Key Constraints](#key-constraints)
7. [Common Queries](#common-queries)

---

## Quick Overview

The database consists of **7 tables**:

| Table | Purpose | Rows |
|-------|---------|------|
| `series` | Anime series metadata & local library info | ~100-1000 |
| `episodes` | Individual episode files | ~5000-50000 |
| `genres` | Unique genre names (lookup) | ~20-50 |
| `series_genres` | Many-to-many: series → genres | ~300-5000 |
| `watch_history` | Episode play events (audit trail) | ~1000-100000 |
| `settings` | Key-value configuration store | ~5-20 |
| `library_folders` | Registered anime folders | ~1-5 |

**Database Creation:** Auto-initialized on first app run via `db::initialize_db()`

---

## Core Tables

### 1. series

Stores anime series metadata and local filesystem information.

**SQL Definition:**
```sql
CREATE TABLE series (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    title_english   TEXT,
    title_native    TEXT,
    local_path      TEXT NOT NULL,
    cover_local_path TEXT,
    cover_remote_url TEXT,
    synopsis        TEXT,
    episode_count   INTEGER,
    status          TEXT NOT NULL DEFAULT 'plan_to_watch',
    anilist_id      INTEGER UNIQUE,
    mal_id          INTEGER,
    anilist_score   REAL,
    mal_score       REAL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
```

**Column Details:**

| Column | Type | Required | Unique | Notes |
|--------|------|----------|--------|-------|
| `id` | INTEGER | Yes | PK | Auto-incremented series identifier |
| `title` | TEXT | Yes | | Primary display title (Romaji preferred from AniList) |
| `title_english` | TEXT | No | | English variant (e.g., "Attack on Titan") |
| `title_native` | TEXT | No | | Japanese/native title (e.g., "進撃の巨人") |
| `local_path` | TEXT | Yes | | Full folder path on disk (stable key for upserts) |
| `cover_local_path` | TEXT | No | | Cached cover image path (e.g., `%APPDATA%/.../covers/Title.jpg`) |
| `cover_remote_url` | TEXT | No | | Original cover URL (for re-download on demand) |
| `synopsis` | TEXT | No | | Series description/plot summary (HTML stripped) |
| `episode_count` | INTEGER | No | | Total episodes (from metadata source) |
| `status` | TEXT | Yes | | Watch status: `watching` \| `completed` \| `on_hold` \| `plan_to_watch` \| `dropped` |
| `anilist_id` | INTEGER | No | Yes | AniList database ID (one per series max, UNIQUE) |
| `mal_id` | INTEGER | No | | MyAnimeList ID (unused in current version) |
| `anilist_score` | REAL | No | | AniList score (0-10 scale, nullable) |
| `mal_score` | REAL | No | | MAL score (1-10 scale, nullable) |
| `created_at` | TEXT | Yes | | ISO 8601 timestamp (e.g., "2026-03-18T14:30:00Z") |
| `updated_at` | TEXT | Yes | | ISO 8601 timestamp of last metadata update |

**Status Values:**

```
'plan_to_watch'  — Not started (default for new series)
'watching'       — Currently watching
'completed'      — Finished watching
'on_hold'        — Paused, plans to resume
'dropped'        — Abandoned
```

**Example Record:**
```json
{
  "id": 1,
  "title": "Shingeki no Kyojin",
  "title_english": "Attack on Titan",
  "title_native": "進撃の巨人",
  "local_path": "C:\\Users\\XX443\\Anime\\Attack on Titan",
  "cover_local_path": "C:\\Users\\XX443\\AppData\\Local\\ru-anishelf\\covers\\Shingeki_no_Kyojin.jpg",
  "cover_remote_url": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/n16498-abcd.jpg",
  "synopsis": "In a world where giant humanoid creatures called Titans rule the world...",
  "episode_count": 89,
  "status": "watching",
  "anilist_id": 16498,
  "mal_id": null,
  "anilist_score": 8.72,
  "mal_score": null,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-03-18T14:22:15Z"
}
```

**Key Operations:**

**Create new series:**
```rust
db::upsert_series(
  &conn,
  "Attack on Titan",        // title
  Some("Attack on Titan"),  // title_english
  Some("進撃の巨人"),         // title_native
  "C:\\Anime\\Attack on Titan",  // local_path (stable key)
  Some("/path/to/cover.jpg"),    // cover_local_path
  Some("https://..."),           // cover_remote_url
  Some("Synopsis..."),           // synopsis
  Some(89),                      // episode_count
  "plan_to_watch",               // status (default)
  Some(16498),                   // anilist_id
  Some(8.72),                    // anilist_score
  &vec!["Action", "Adventure"]   // genres
)?;
```

**Get all series:**
```rust
let all_series = db::get_all_series(&conn)?;
// Returns Vec<SeriesRecord> with genres pre-loaded
```

**Update status only:**
```rust
db::update_series_status(&conn, series_id, "completed")?;
```

---

### 2. episodes

Stores individual episode files detected during folder scan.

**SQL Definition:**
```sql
CREATE TABLE episodes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id       INTEGER NOT NULL,
    episode_number  INTEGER NOT NULL,
    file_path       TEXT NOT NULL,
    file_name       TEXT,
    season_name     TEXT NOT NULL DEFAULT 'Season 1',
    watched         INTEGER NOT NULL DEFAULT 0,
    watched_at      TEXT,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);
```

**Column Details:**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | INTEGER | Yes | Auto-incremented episode ID |
| `series_id` | INTEGER | Yes | FK to `series.id` (CASCADE delete) |
| `episode_number` | INTEGER | Yes | Episode number (e.g., 1, 2, 25) |
| `file_path` | TEXT | Yes | Full filesystem path to episode file |
| `file_name` | TEXT | No | Filename only (e.g., "01 - Prologue.mkv") |
| `season_name` | TEXT | Yes | Season folder name (e.g., "Season 1", "OVA") |
| `watched` | INTEGER | Yes | Flag: 0=unwatched, 1=watched (currently unused) |
| `watched_at` | TEXT | No | ISO 8601 timestamp (currently unused) |

**Example Records:**
```json
[
  {
    "id": 1,
    "series_id": 1,
    "episode_number": 1,
    "file_path": "C:\\Anime\\Attack on Titan\\Season 1\\01 - To Your 2000 Years Later.mkv",
    "file_name": "01 - To Your 2000 Years Later.mkv",
    "season_name": "Season 1",
    "watched": 0,
    "watched_at": null
  },
  {
    "id": 2,
    "series_id": 1,
    "episode_number": 2,
    "file_path": "C:\\Anime\\Attack on Titan\\Season 1\\02 - That Day When The World Ended.mkv",
    "file_name": "02 - That Day When The World Ended.mkv",
    "season_name": "Season 1",
    "watched": 0,
    "watched_at": null
  }
]
```

**Key Operations:**

**Save episodes (bulk insert, clears old):**
```rust
let episodes = vec![
  (1, "C:\\Anime\\AoT\\S1\\01.mkv", "01.mkv", "Season 1"),
  (2, "C:\\Anime\\AoT\\S1\\02.mkv", "02.mkv", "Season 1"),
];
db::save_episodes(&conn, series_id, &episodes)?;
// Clears existing episodes for series_id first, then inserts new ones
```

**Get episodes for a series:**
```rust
let episodes = db::get_episodes(&conn, series_id)?;
// Returns Vec<EpisodeRecord>, sorted by season_name, then episode_number
```

**Cascading Delete:**
If a series is deleted, all its episodes automatically deleted via `ON DELETE CASCADE`.

---

## Junction & Reference Tables

### 3. genres

Lookup table for unique genre names.

**SQL Definition:**
```sql
CREATE TABLE genres (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
```

**Column Details:**

| Column | Type | Required | Unique | Notes |
|--------|------|----------|--------|-------|
| `id` | INTEGER | Yes | PK | Genre identifier |
| `name` | TEXT | Yes | Yes | Genre name (e.g., "Action", "Drama", "Supernatural") |

**Example Records:**
```json
[
  { "id": 1, "name": "Action" },
  { "id": 2, "name": "Adventure" },
  { "id": 3, "name": "Dark Fantasy" },
  { "id": 4, "name": "Drama" },
  { "id": 5, "name": "Supernatural" }
]
```

**Notes:**
- Genre names are case-sensitive (exact match)
- Different metadata sources (AniList, MAL, Kitsu) may use different casing
- Normalization happens at fetch time in `metadata.rs`

---

### 4. series_genres

Junction table for many-to-many relationship between series and genres.

**SQL Definition:**
```sql
CREATE TABLE series_genres (
    series_id  INTEGER NOT NULL,
    genre_id   INTEGER NOT NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id)  REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (series_id, genre_id)
);
```

**Column Details:**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `series_id` | INTEGER | Yes | FK to `series.id` (CASCADE delete) |
| `genre_id` | INTEGER | Yes | FK to `genres.id` (CASCADE delete) |

**Example Data:**

Series 1 (Attack on Titan) linked to genres [Action, Adventure, Dark Fantasy]:
```
series_id  |  genre_id
-----------|----------
    1      |     1     (Action)
    1      |     2     (Adventure)
    1      |     3     (Dark Fantasy)
```

**Query Example:**
```sql
-- Get all genres for a series
SELECT g.name FROM genres g
JOIN series_genres sg ON sg.genre_id = g.id
WHERE sg.series_id = 1
ORDER BY g.name;
-- Result: ["Action", "Adventure", "Dark Fantasy"]
```

---

## Configuration Tables

### 5. settings

Key-value store for app configuration and user preferences.

**SQL Definition:**
```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

**Column Details:**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `key` | TEXT | Yes | Setting identifier (e.g., "mal_client_id") |
| `value` | TEXT | Yes | Setting value (stored as text) |

**Common Settings:**

| Key | Type | Example | Purpose |
|-----|------|---------|---------|
| `mal_client_id` | string | `"client_id_abc123xyz"` | MyAnimeList API authentication token |
| `theme` | string | `"obsidian"` | Active theme name (cinematic, cli, meadow, obsidian, etc.) |
| `player_path` | string | `"C:\\Program Files\\VLC\\vlc.exe"` | Media player executable for opening episodes |
| `kitsu_username` | string | `"@ColinOffshore"` | Kitsu profile username for stats |
| `metadata_source` | string | `"anilist"` \| `"mal"` \| `"kitsu"` | Default metadata source |

**Example Records:**
```json
[
  { "key": "mal_client_id", "value": "abc123xyz" },
  { "key": "theme", "value": "obsidian" },
  { "key": "player_path", "value": "C:\\Program Files\\VLC\\vlc.exe" }
]
```

**Operations:**

**Save a setting:**
```rust
db::save_setting(&conn, "mal_client_id", "abc123xyz")?;
// Uses INSERT OR IGNORE with UPDATE on conflict
```

**Get a setting:**
```rust
let client_id = db::get_setting(&conn, "mal_client_id")?;
// Returns Option<String>
```

---

### 6. library_folders

Stores registered library folder paths for scanning.

**SQL Definition:**
```sql
CREATE TABLE library_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT NOT NULL UNIQUE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
```

**Column Details:**

| Column | Type | Required | Unique | Notes |
|--------|------|----------|--------|-------|
| `id` | INTEGER | Yes | PK | Folder identifier |
| `path` | TEXT | Yes | Yes | Absolute folder path (UNIQUE prevents duplicates) |
| `is_primary` | INTEGER | Yes | | 1 if primary library, 0 otherwise (only one primary) |
| `created_at` | TEXT | Yes | | ISO 8601 timestamp when folder registered |

**Example Records:**
```json
[
  {
    "id": 1,
    "path": "C:\\Users\\XX443\\Anime",
    "is_primary": 1,
    "created_at": "2025-12-01T10:00:00Z"
  },
  {
    "id": 2,
    "path": "D:\\Anime Collections",
    "is_primary": 0,
    "created_at": "2026-01-15T14:30:00Z"
  }
]
```

**Behavior:**
- First folder added automatically becomes primary
- If primary folder removed, oldest remaining folder is promoted
- Duplicate paths ignored (UNIQUE constraint)

---

### 7. watch_history

Audit trail of watched episodes with timestamps.

**SQL Definition:**
```sql
CREATE TABLE watch_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    series_name     TEXT NOT NULL,
    series_path     TEXT NOT NULL,
    cover_url       TEXT,
    episode_name    TEXT NOT NULL,
    episode_path    TEXT NOT NULL,
    episode_number  INTEGER NOT NULL,
    season_name     TEXT NOT NULL,
    watched_at      TEXT NOT NULL
);
```

**Column Details:**

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | INTEGER | Yes | Event identifier |
| `series_name` | TEXT | Yes | Series title at time of watch (denormalized snapshot) |
| `series_path` | TEXT | Yes | Series folder path (denormalized) |
| `cover_url` | TEXT | No | Cover image URL for display (denormalized) |
| `episode_name` | TEXT | Yes | Episode filename (denormalized snapshot) |
| `episode_path` | TEXT | Yes | Episode file full path (denormalized) |
| `episode_number` | INTEGER | Yes | Episode number (denormalized) |
| `season_name` | TEXT | Yes | Season folder name (denormalized) |
| `watched_at` | TEXT | Yes | ISO 8601 timestamp when episode was played |

**Example Record:**
```json
{
  "id": 1,
  "series_name": "Attack on Titan",
  "series_path": "C:\\Anime\\Attack on Titan",
  "cover_url": "https://s4.anilist.co/file/...",
  "episode_name": "01 - To Your 2000 Years Later.mkv",
  "episode_path": "C:\\Anime\\Attack on Titan\\Season 1\\01.mkv",
  "episode_number": 1,
  "season_name": "Season 1",
  "watched_at": "2026-03-18T20:15:32Z"
}
```

**Operations:**

**Log a watch event:**
```rust
db::save_watch_event(
  &conn,
  "Attack on Titan",
  "C:\\Anime\\AoT",
  Some("https://..."),
  "01 - Prologue.mkv",
  "C:\\Anime\\AoT\\S1\\01.mkv",
  1,
  "Season 1"
)?;
```

**Get recent history:**
```rust
let history = db::get_watch_history(&conn, 100)?;
// Returns Vec<WatchEvent>, sorted by watched_at DESC (newest first)
```

**Clear all history:**
```rust
db::clear_watch_history(&conn)?;
```

**Design Note:** This table is **denormalized** (duplicates data from series/episodes tables). This allows history to survive even if series/episodes are deleted from library.

---

## Schema Diagram

```
┌──────────────────────────────┐
│         series               │
│  id (PK)                     │
│  title                       │
│  title_english               │
│  title_native                │
│  local_path                  │
│  cover_local_path            │
│  cover_remote_url            │
│  synopsis                    │
│  episode_count               │
│  status                      │
│  anilist_id (UNIQUE)         │
│  mal_id                      │
│  anilist_score               │
│  mal_score                   │
│  created_at                  │
│  updated_at                  │
└──────────────┬───────────────┘
               │
               │ 1:N
               │
        ┌──────▼──────────────┐
        │    episodes          │
        │  id (PK)            │
        │  series_id (FK)     │
        │  episode_number     │
        │  file_path          │
        │  file_name          │
        │  season_name        │
        │  watched            │
        │  watched_at         │
        └─────────────────────┘


┌──────────────────────┐     ┌──────────────────┐     ┌─────────────┐
│    series            │     │ series_genres    │     │   genres    │
│  id (PK)             │────<│  series_id (FK)  │    >│  id (PK)    │
└──────────────────────┘  N:M │  genre_id (FK)   │  N:M └─────────────┘
                             │  (PK)            │
                             └──────────────────┘

┌──────────────────────┐
│ watch_history        │  (denormalized, no FK)
│  id (PK)             │
│  series_name         │
│  series_path         │
│  cover_url           │
│  episode_name        │
│  episode_path        │
│  episode_number      │
│  season_name         │
│  watched_at          │
└──────────────────────┘

┌──────────────────────┐
│   settings           │  (key-value store)
│  key (PK)            │
│  value               │
└──────────────────────┘

┌──────────────────────┐
│ library_folders      │
│  id (PK)             │
│  path (UNIQUE)       │
│  is_primary          │
│  created_at          │
└──────────────────────┘
```

---

## Key Constraints

### Foreign Key Enforcement

Foreign keys enabled globally via pragma:
```sql
PRAGMA foreign_keys = ON;
```

**Cascading Deletes:**
- Delete `series` → auto-deletes all `episodes` for that series
- Delete `series` → auto-deletes all `series_genres` for that series
- Delete `genre` → auto-deletes all `series_genres` for that genre

### Unique Constraints

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| `series` | `anilist_id` | Prevent duplicate AniList mappings |
| `genres` | `name` | Prevent duplicate genre names |
| `library_folders` | `path` | Prevent duplicate library folder registrations |
| `series_genres` | `(series_id, genre_id)` | Prevent duplicate genre assignments to series |

### Default Values

| Table | Column | Default |
|-------|--------|---------|
| `series` | `status` | `'plan_to_watch'` |
| `episodes` | `season_name` | `'Season 1'` |
| `episodes` | `watched` | `0` |
| `library_folders` | `is_primary` | `0` |

---

## Common Queries

### Get Series with All Details

```sql
SELECT s.*, GROUP_CONCAT(g.name, ', ') as genres
FROM series s
LEFT JOIN series_genres sg ON s.id = sg.series_id
LEFT JOIN genres g ON sg.genre_id = g.id
WHERE s.id = ?
GROUP BY s.id;
```

### Get Episodes for a Series

```sql
SELECT * FROM episodes
WHERE series_id = ?
ORDER BY season_name ASC, episode_number ASC;
```

### Get Series by Status

```sql
SELECT * FROM series
WHERE status = 'watching'
ORDER BY title ASC;
```

### Get Watch History (Most Recent)

```sql
SELECT * FROM watch_history
ORDER BY watched_at DESC
LIMIT 50;
```

### Find Series Missing Metadata

```sql
SELECT * FROM series
WHERE anilist_id IS NULL
   OR cover_local_path IS NULL
   OR synopsis IS NULL
ORDER BY title;
```

### Count Episodes per Series

```sql
SELECT series_id, COUNT(*) as episode_count
FROM episodes
GROUP BY series_id;
```

### Get Most Recently Watched Series

```sql
SELECT DISTINCT series_name, MAX(watched_at) as last_watched
FROM watch_history
GROUP BY series_name
ORDER BY last_watched DESC
LIMIT 10;
```

---

## Data Type Reference

| SQLite | Rust Equivalent | Usage |
|--------|-----------------|-------|
| INTEGER | `i32`, `i64` | IDs, counts, episode numbers, flags |
| TEXT | `String` | Titles, paths, URLs, timestamps (ISO 8601) |
| REAL | `f64` | Decimal scores (e.g., 8.72) |
| NULL | `Option<T>` | Optional/nullable values |

---

## Timestamp Format

All timestamps use **ISO 8601 format with UTC timezone**:

```
Format: "2026-03-18T14:30:00Z"

Generated via Rust:
  chrono::Utc::now().to_rfc3339()
```

---

**Version:** 0.1.0  
**Last Updated:** March 18, 2026  
**Database Format:** SQLite 3  
**PRAGMA:** `FOREIGN_KEYS = ON`
