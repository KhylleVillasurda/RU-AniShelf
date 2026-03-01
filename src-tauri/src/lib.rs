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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    match db::initialize_db() {
        Ok(_) => println!("✅ Database initialized successfully"),
        Err(e) => eprintln!("❌ Database initialization failed: {}", e),
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scan_anime_folder, fetch_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
