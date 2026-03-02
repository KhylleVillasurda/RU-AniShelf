mod db;
mod metadata;
mod scanner;
use std::sync::Mutex;
struct DbState(Mutex<rusqlite::Connection>);

#[tauri::command]
fn scan_anime_folder(path: String) -> Vec<scanner::DiscoveredSeries> {
    scanner::scan_folder(&path)
}

#[tauri::command]
async fn fetch_metadata(title: String) -> Result<metadata::SeriesMetadata, String> {
    metadata::fetch_anilist_metadata(&title).await
}

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
            // Trim whitespace from saved player path
            let player = player.trim().to_string();

            std::process::Command::new(&player)
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to launch player '{}': {}", player, e))?;
        }
        _ => {
            // Fall back to OS default
            opener::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::initialize_db().expect("Failed to initialize database");

    println!("Database initialized successfully");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_anime_folder,
            fetch_metadata,
            open_episode,
            log_watch_event,
            get_history,
            save_setting,
            get_setting,
            get_all_settings,
            clear_history,
            get_library,
            save_series_to_library,
            update_series_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

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

#[tauri::command]
fn save_setting(state: tauri::State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::save_setting(&conn, &key, &value).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
fn get_setting(state: tauri::State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::get_setting(&conn, &key).map_err(|e| format!("DB error: {}", e))
}

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

#[tauri::command]
fn clear_history(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    db::clear_watch_history(&conn).map_err(|e| format!("DB error: {}", e))
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

#[tauri::command]
async fn get_library(state: tauri::State<'_, DbState>) -> Result<Vec<SeriesDto>, String> {
    let conn = state
        .0
        .lock()
        .map_err(|e| format!("DB lock error: {}", e))?;
    let series = db::get_all_series(&conn).map_err(|e| format!("DB error: {}", e))?;

    let mut result = Vec::new();

    for s in series {
        // Load episodes for each series
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
    // Each episode: [episode_number, file_path, file_name, season_name]
    episodes: Vec<(i32, String, String, String)>,
) -> Result<i64, String> {
    let cover_local_path = if let Some(ref url) = cover_remote_url {
        match metadata::download_cover(url, &title).await {
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

    // Save episodes
    let episode_refs: Vec<(i32, &str, &str, &str)> = episodes
        .iter()
        .map(|(n, fp, fn_, sn)| (*n, fp.as_str(), fn_.as_str(), sn.as_str()))
        .collect();

    db::save_episodes(&conn, series_id, &episode_refs).map_err(|e| format!("DB error: {}", e))?;

    Ok(series_id)
}

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
