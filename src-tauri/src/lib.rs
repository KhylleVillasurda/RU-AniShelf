// =============================================================================
// lib.rs — Tauri command layer
//
// All public-facing commands invokable from the frontend live here.
// This file is intentionally thin — it delegates to db.rs and metadata.rs
// and only handles argument wiring, DTO mapping, and error formatting.
//
// SECTIONS (in order):
//   1. Module Imports & State
//   2. DTOs  (structs serialized back to the frontend)
//   3. Library Folder Management  (add / remove / list)
//   4. Search & Metadata          (AniList, MAL)
//   5. Scanner                    (filesystem discovery)
//   6. Library Management         (get, save, update series)
//   7. Watch History              (log, get, clear)
//   8. Settings                   (key-value store)
//   9. Utilities                  (open episode, get MAL client ID)
//   10. Kitsu Integration          (fetch metadata by Kitsu slug)
//   11. App Initialization         (Tauri builder + command registration)
// =============================================================================

// ─── 1. Module Imports & State ────────────────────────────────────────────────

mod db;
mod kitsu;
mod metadata;
mod scanner;

use std::sync::Mutex;

/// Shared SQLite connection wrapped in a Mutex for thread-safe Tauri state
struct DbState(Mutex<rusqlite::Connection>);

// ─── 2. DTOs ─────────────────────────────────────────────────────────────────
// These mirror the DB structs in db.rs but are serialized to JSON for the
// frontend. Keep field names in snake_case — Tauri handles the camelCase
// conversion on the JS side automatically.

#[derive(serde::Serialize)]
struct SearchResultDto {
    anilist_id: i64,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    anilist_score: Option<f64>,
    cover_url: Option<String>,
    genres: Vec<String>,
    status: Option<String>,
    format: Option<String>,
    season_year: Option<i32>,
}

#[derive(serde::Serialize)]
struct WatchEventDto {
    series_name: String,
    series_path: String,
    cover_url: Option<String>,
    episode_name: String,
    episode_path: String,
    episode_number: i32,
    season_name: String,
    watched_at: String,
}

#[derive(serde::Serialize)]
struct SeriesDto {
    id: i64,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    local_path: String,
    cover_local_path: Option<String>,
    cover_remote_url: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    status: String,
    anilist_id: Option<i64>,
    anilist_score: Option<f64>,
    genres: Vec<String>,
    episodes: Vec<EpisodeDto>,
}

#[derive(serde::Serialize)]
struct EpisodeDto {
    episode_number: i32,
    file_path: String,
    file_name: String,
    season_name: String,
}

#[derive(serde::Serialize)]
struct MalResultDto {
    mal_id: i64,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    mal_score: Option<f64>,
    cover_url: Option<String>,
    genres: Vec<String>,
    status: Option<String>,
    format: Option<String>,
    season_year: Option<i32>,
}

#[derive(serde::Serialize)]
struct KitsuResultDto {
    kitsu_id: i64,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    kitsu_score: Option<f64>,
    cover_url: Option<String>,
    genres: Vec<String>,
    status: Option<String>,
    format: Option<String>,
    season_year: Option<i32>,
}

// ─── 3. Library Folder Management ────────────────────────────────────────────

#[tauri::command]
async fn get_library_folders(state: tauri::State<'_, DbState>) -> Result<Vec<String>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT path FROM library_folders ORDER BY is_primary DESC, created_at ASC")
        .map_err(|e| format!("DB error: {}", e))?;

    let folders = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("DB error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(folders)
}

#[tauri::command]
async fn add_library_folder(state: tauri::State<'_, DbState>, path: String) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    // First folder added becomes primary automatically
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM library_folders", [], |row| row.get(0))
        .unwrap_or(0);

    let is_primary = if count == 0 { 1 } else { 0 };

    conn.execute(
        "INSERT OR IGNORE INTO library_folders (path, is_primary, created_at)
         VALUES (?1, ?2, ?3)",
        rusqlite::params![path, is_primary, now],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn remove_library_folder(
    state: tauri::State<'_, DbState>,
    path: String,
) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    conn.execute("DELETE FROM library_folders WHERE path = ?1", [path])
        .map_err(|e| format!("DB error: {}", e))?;

    // If no primary remains, promote the oldest remaining folder
    let primary_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM library_folders WHERE is_primary = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if primary_count == 0 {
        conn.execute(
            "UPDATE library_folders SET is_primary = 1
             WHERE id = (SELECT id FROM library_folders ORDER BY created_at ASC LIMIT 1)",
            [],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    Ok(())
}

// ─── 4. Search & Metadata ─────────────────────────────────────────────────────

/// Searches AniList for multiple results and returns them as SearchResultDtos
#[tauri::command]
async fn search_anime_multi(title: String) -> Result<Vec<SearchResultDto>, String> {
    let results = metadata::search_anime_multi(&title).await?;

    Ok(results
        .into_iter()
        .map(|m| SearchResultDto {
            anilist_id: m.anilist_id,
            title: m.title,
            title_english: m.title_english,
            title_native: m.title_native,
            synopsis: m.synopsis,
            episode_count: m.episode_count,
            anilist_score: m.anilist_score,
            cover_url: m.cover_url,
            genres: m.genres,
            status: m.status,
            format: m.format,
            season_year: m.season_year,
        })
        .collect())
}

/// Single best-match AniList fetch (used by MetadataEditModal)
#[tauri::command]
async fn fetch_metadata(title: String) -> Result<metadata::SeriesMetadata, String> {
    metadata::fetch_anilist_metadata(&title).await
}

/// Searches MAL for multiple results — requires a MAL Client ID in settings
#[tauri::command]
async fn search_mal_multi(
    state: tauri::State<'_, DbState>,
    title: String,
) -> Result<Vec<MalResultDto>, String> {
    let client_id = {
        let conn = state
            .0
            .lock()
            .map_err(|e| format!("DB lock error: {}", e))?;
        db::get_setting(&conn, "mal_client_id")
            .unwrap_or_default()
            .unwrap_or_default()
    };

    if client_id.is_empty() {
        return Err("MAL Client ID not set — add it in Settings".to_string());
    }

    // Trim to first 4 words and strip punctuation for cleaner MAL queries
    let search_title = title
        .split_whitespace()
        .take(4)
        .collect::<Vec<_>>()
        .join(" ")
        .replace(',', "")
        .replace('.', "")
        .trim()
        .to_string();

    let results = metadata::search_mal_multi(&search_title, &client_id).await?;

    Ok(results
        .into_iter()
        .map(|m| MalResultDto {
            mal_id: m.mal_id,
            title: m.title,
            title_english: m.title_english,
            title_native: m.title_native,
            synopsis: m.synopsis,
            episode_count: m.episode_count,
            mal_score: m.mal_score,
            cover_url: m.cover_url,
            genres: m.genres,
            status: m.status,
            format: m.format,
            season_year: m.season_year,
        })
        .collect())
}

/// Searches Kitsu for multiple results — no API key required
#[tauri::command]
async fn search_kitsu_multi(title: String) -> Result<Vec<KitsuResultDto>, String> {
    // Trim to first 4 words for cleaner Kitsu queries (same heuristic as MAL)
    let search_title = title
        .split_whitespace()
        .take(4)
        .collect::<Vec<_>>()
        .join(" ")
        .replace(',', "")
        .replace('.', "")
        .trim()
        .to_string();

    let results = metadata::search_kitsu_multi(&search_title).await?;

    Ok(results
        .into_iter()
        .map(|k| KitsuResultDto {
            kitsu_id: k.kitsu_id,
            title: k.title,
            title_english: k.title_english,
            title_native: k.title_native,
            synopsis: k.synopsis,
            episode_count: k.episode_count,
            kitsu_score: k.kitsu_score,
            cover_url: k.cover_url,
            genres: k.genres,
            status: k.status,
            format: k.format,
            season_year: k.season_year,
        })
        .collect())
}

// ─── 5. Scanner ───────────────────────────────────────────────────────────────

/// Scans a folder path for anime series and returns discovered entries
#[tauri::command]
fn scan_anime_folder(path: String) -> Vec<scanner::DiscoveredSeries> {
    scanner::scan_folder(&path)
}

// ─── 6. Library Management ───────────────────────────────────────────────────

/// Returns all series from the DB with their episodes, for the library grid
#[tauri::command]
async fn get_library(state: tauri::State<'_, DbState>) -> Result<Vec<SeriesDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    let series = db::get_all_series(&conn).map_err(|e| format!("DB error: {}", e))?;

    let mut result = Vec::new();
    for s in series {
        let episodes = db::get_episodes(&conn, s.id)
            .map_err(|e| format!("DB error: {}", e))?
            .into_iter()
            .map(|e| EpisodeDto {
                episode_number: e.episode_number,
                file_path: e.file_path,
                file_name: e.file_name,
                season_name: e.season_name,
            })
            .collect();

        result.push(SeriesDto {
            id: s.id,
            title: s.title,
            title_english: s.title_english,
            title_native: s.title_native,
            local_path: s.local_path,
            cover_local_path: s.cover_local_path,
            cover_remote_url: s.cover_remote_url,
            synopsis: s.synopsis,
            episode_count: s.episode_count,
            status: s.status,
            anilist_id: s.anilist_id,
            anilist_score: s.anilist_score,
            genres: s.genres,
            episodes,
        });
    }

    Ok(result)
}

/// Inserts or updates a series and its episodes in the DB.
/// Downloads and caches cover art locally.
/// force_refresh = true re-downloads the cover even if already cached
/// (used during rescan to pick up cover changes from a different source).
#[tauri::command]
async fn save_series_to_library(
    state: tauri::State<'_, DbState>,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    local_path: String,
    cover_remote_url: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    anilist_id: Option<i64>,
    anilist_score: Option<f64>,
    genres: Vec<String>,
    force_refresh: bool,
    // Each episode: (episode_number, file_path, file_name, season_name)
    episodes: Vec<(i32, String, String, String)>,
) -> Result<i64, String> {
    let cover_local_path = if let Some(ref url) = cover_remote_url {
        match metadata::download_cover(url, &title, force_refresh).await {
            Ok(path) => Some(path),
            Err(_) => None,
        }
    } else {
        None
    };

    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    let series_id = db::upsert_series(
        &conn,
        &title,
        title_english.as_deref(),
        title_native.as_deref(),
        &local_path,
        cover_local_path.as_deref(),
        cover_remote_url.as_deref(),
        synopsis.as_deref(),
        episode_count,
        "plan_to_watch",
        anilist_id,
        anilist_score,
        &genres,
    )
    .map_err(|e| format!("DB error: {}", e))?;

    let episode_refs: Vec<(i32, &str, &str, &str)> = episodes
        .iter()
        .map(|(n, fp, fn_, sn)| (*n, fp.as_str(), fn_.as_str(), sn.as_str()))
        .collect();

    db::save_episodes(&conn, series_id, &episode_refs).map_err(|e| format!("DB error: {}", e))?;

    Ok(series_id)
}

/// Updates metadata for an existing series (title, cover, synopsis, genres, etc.).
/// Always force-refreshes the cover so switching source is reflected immediately.
#[tauri::command]
async fn update_series_metadata(
    state: tauri::State<'_, DbState>,
    series_id: i64,
    title: String,
    title_english: Option<String>,
    title_native: Option<String>,
    cover_remote_url: Option<String>,
    synopsis: Option<String>,
    episode_count: Option<i32>,
    anilist_id: Option<i64>,
    anilist_score: Option<f64>,
    genres: Vec<String>,
) -> Result<(), String> {
    // Always force-refresh the cover on a manual edit
    let cover_local_path = if let Some(ref url) = cover_remote_url {
        match metadata::download_cover(url, &title, true).await {
            Ok(path) => Some(path),
            Err(_) => None,
        }
    } else {
        None
    };

    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE series SET
            title = ?1,
            title_english = ?2,
            title_native = ?3,
            cover_remote_url = ?4,
            cover_local_path = ?5,
            synopsis = ?6,
            episode_count = ?7,
            anilist_id = ?8,
            anilist_score = ?9,
            updated_at = ?10
         WHERE id = ?11",
        rusqlite::params![
            title,
            title_english,
            title_native,
            cover_remote_url,
            cover_local_path,
            synopsis,
            episode_count,
            anilist_id,
            anilist_score,
            now,
            series_id,
        ],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    // Clear and reinsert genres
    conn.execute(
        "DELETE FROM series_genres WHERE series_id = ?1",
        [series_id],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    for genre in &genres {
        conn.execute("INSERT OR IGNORE INTO genres (name) VALUES (?1)", [genre])
            .map_err(|e| format!("DB error: {}", e))?;

        let genre_id: i64 = conn
            .query_row("SELECT id FROM genres WHERE name = ?1", [genre], |row| {
                row.get(0)
            })
            .map_err(|e| format!("DB error: {}", e))?;

        conn.execute(
            "INSERT OR IGNORE INTO series_genres (series_id, genre_id)
             VALUES (?1, ?2)",
            rusqlite::params![series_id, genre_id],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    Ok(())
}

/// Updates only the watch status (watching / completed / on_hold / plan_to_watch)
#[tauri::command]
async fn update_series_status(
    state: tauri::State<'_, DbState>,
    series_id: i64,
    status: String,
) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::update_series_status(&conn, series_id, &status).map_err(|e| format!("DB error: {}", e))
}

// ─── 7. Watch History ─────────────────────────────────────────────────────────

/// Appends an episode watch event to the history table
#[tauri::command]
fn log_watch_event(
    state: tauri::State<DbState>,
    series_name: String,
    series_path: String,
    cover_url: Option<String>,
    episode_name: String,
    episode_path: String,
    episode_number: i32,
    season_name: String,
) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::save_watch_event(
        &conn,
        &series_name,
        &series_path,
        cover_url.as_deref(),
        &episode_name,
        &episode_path,
        episode_number,
        &season_name,
    )
    .map_err(|e| format!("DB error: {}", e))
}

/// Returns the most recent watch events up to `limit`
#[tauri::command]
fn get_history(state: tauri::State<DbState>, limit: i32) -> Result<Vec<WatchEventDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    let events = db::get_watch_history(&conn, limit).map_err(|e| format!("DB error: {}", e))?;

    Ok(events
        .into_iter()
        .map(|e| WatchEventDto {
            series_name: e.series_name,
            series_path: e.series_path,
            cover_url: e.cover_url,
            episode_name: e.episode_name,
            episode_path: e.episode_path,
            episode_number: e.episode_number,
            season_name: e.season_name,
            watched_at: e.watched_at,
        })
        .collect())
}

/// Wipes the entire watch history table
#[tauri::command]
fn clear_history(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::clear_watch_history(&conn).map_err(|e| format!("DB error: {}", e))
}

// ─── 8. Settings ──────────────────────────────────────────────────────────────

/// Upserts a single key-value setting
#[tauri::command]
fn save_setting(state: tauri::State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::save_setting(&conn, &key, &value).map_err(|e| format!("DB error: {}", e))
}

/// Returns a single setting by key, or None if not set
#[tauri::command]
fn get_setting(state: tauri::State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::get_setting(&conn, &key).map_err(|e| format!("DB error: {}", e))
}

/// Returns all settings as a key-value map (used on the Settings page)
#[tauri::command]
fn get_all_settings(
    state: tauri::State<DbState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("DB error: {}", e))?;

    let map = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("DB error: {}", e))?
        .flatten()
        .collect();

    Ok(map)
}

// ─── 9. Utilities ─────────────────────────────────────────────────────────────

/// Opens an episode file in the configured media player, or the OS default
#[tauri::command]
async fn open_episode(state: tauri::State<'_, DbState>, file_path: String) -> Result<(), String> {
    let player_path = {
        let conn = state
            .0
            .lock()
            .map_err(|e| format!("DB lock error: {}", e))?;
        db::get_setting(&conn, "player_path").map_err(|e| format!("DB error: {}", e))?
    };

    match player_path {
        Some(player) if !player.trim().is_empty() => {
            let player = player.trim().to_string();
            std::process::Command::new(&player)
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to launch player '{}': {}", player, e))?;
        }
        _ => {
            opener::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        }
    }

    Ok(())
}

/// Returns the saved MAL Client ID from settings (empty string if not set)
#[tauri::command]
async fn get_mal_client_id(state: tauri::State<'_, DbState>) -> Result<String, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    Ok(db::get_setting(&conn, "mal_client_id")
        .unwrap_or_default()
        .unwrap_or_default())
}

// ─── 10. Kitsu Integration ───────────────────────────────────────────────────

/// Fetches a public Kitsu user profile, bio, and anime/manga genre stats.
/// Called by the ProfilePage — username comes from the kitsu_username setting.
#[tauri::command]
async fn fetch_kitsu_profile(username: String) -> Result<kitsu::KitsuProfile, String> {
    kitsu::fetch_kitsu_profile(&username).await
}

/// Saves a serialised KitsuProfile JSON string to the kitsu_cache table.
/// Called by the frontend after a successful fetch so data persists across sessions.
/// Creates the table on first use — no db.rs migration needed.
#[tauri::command]
fn save_kitsu_cache(
    state: tauri::State<DbState>,
    username: String,
    json: String,
) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    // Create table if it doesn't exist yet (lazy migration)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kitsu_cache (
            username  TEXT PRIMARY KEY,
            data      TEXT NOT NULL,
            cached_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("DB error creating kitsu_cache table: {}", e))?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO kitsu_cache (username, data, cached_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(username) DO UPDATE SET data = ?2, cached_at = ?3",
        rusqlite::params![username, json, now],
    )
    .map_err(|e| format!("DB error saving kitsu cache: {}", e))?;
    Ok(())
}

/// Returns the cached KitsuProfile JSON for the given username, or null if not cached.
#[tauri::command]
fn get_kitsu_cache(
    state: tauri::State<DbState>,
    username: String,
) -> Result<Option<String>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    // Table may not exist yet if save has never been called
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kitsu_cache (
            username  TEXT PRIMARY KEY,
            data      TEXT NOT NULL,
            cached_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("DB error: {}", e))?;
    let result = conn.query_row(
        "SELECT data FROM kitsu_cache WHERE username = ?1",
        rusqlite::params![username],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(json) => Ok(Some(json)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("DB error reading kitsu cache: {}", e)),
    }
}

// ─── 11. App Initialization ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::initialize_db().expect("Failed to initialize database");

    println!("SUCCESS: Database initialized successfully");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Scanner
            scan_anime_folder,
            // Metadata
            fetch_metadata,
            search_anime_multi,
            search_mal_multi,
            search_kitsu_multi,
            // Library
            get_library,
            save_series_to_library,
            update_series_metadata,
            update_series_status,
            // Library folders
            get_library_folders,
            add_library_folder,
            remove_library_folder,
            // Watch history
            log_watch_event,
            get_history,
            clear_history,
            // Settings
            save_setting,
            get_setting,
            get_all_settings,
            // Utilities
            open_episode,
            get_mal_client_id,
            // Kitsu
            fetch_kitsu_profile,
            save_kitsu_cache,
            get_kitsu_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}