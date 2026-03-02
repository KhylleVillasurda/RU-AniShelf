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
async fn open_episode(file_path: String) -> Result<(), String> {
    // opener::open uses the OS default handler for the file type
    // On Windows .mkv/.mp4 files open in whatever the default video player is
    opener::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))
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
