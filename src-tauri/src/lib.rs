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
    // Check if user has configured a custom player
    let player_path = {
        let conn = state
            .0
            .lock()
            .map_err(|e| format!("DB lock error: {}", e))?;
        db::get_setting(&conn, "player_path").map_err(|e| format!("DB error: {}", e))?
    };

    match player_path {
        Some(player) if !player.is_empty() => {
            // Launch with configured player
            std::process::Command::new(&player)
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to launch player: {}", e))?;
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
