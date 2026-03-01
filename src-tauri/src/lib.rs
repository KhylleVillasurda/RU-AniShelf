mod db;
mod metadata;
mod scanner;

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
    match db::initialize_db() {
        Ok(_) => println!("✅ Database initialized successfully"),
        Err(e) => eprintln!("❌ Database initialization failed: {}", e),
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_anime_folder,
            fetch_metadata,
            open_episode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
