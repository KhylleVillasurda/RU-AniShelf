use serde::Serialize;
use std::path::Path;

const VIDEO_EXTENSIONS: &[&str] = &["mkv", "mp4", "avi", "mov", "wmv", "m4v"];

#[derive(Debug, Serialize)]
pub struct DiscoveredSeries {
    pub name: String,
    pub path: String, // Now points to the SERIES root folder
    pub episode_files: Vec<EpisodeFile>,
    pub seasons: Vec<Season>, // NEW — grouped season breakdown
}

#[derive(Debug, Serialize)]
pub struct Season {
    pub season_name: String, // e.g. "Season 1" or "Root" for flat anime
    pub path: String,
    pub episode_files: Vec<EpisodeFile>,
}

#[derive(Debug, Serialize)]
pub struct EpisodeFile {
    pub file_name: String,
    pub file_path: String,
}

/// Detects if a folder name looks like a season folder
/// Handles: "Season 1", "Season 01", "S1", "S01", "season1" etc.
fn is_season_folder(name: &str) -> bool {
    let lower = name.to_lowercase();
    let normalized = lower.trim();

    // Matches "season 1", "season1", "season 01"
    if normalized.starts_with("season") {
        let rest = normalized.trim_start_matches("season").trim();
        return rest.chars().all(|c| c.is_numeric());
    }

    // Matches "s1", "s01", "s001"
    if normalized.starts_with('s') {
        let rest = &normalized[1..];
        return !rest.is_empty() && rest.chars().all(|c| c.is_numeric());
    }

    false
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Collects video files from a directory (non-recursive)
/// Used when we already know which folder to look in
fn collect_episodes_in_dir(dir: &Path) -> Vec<EpisodeFile> {
    let mut episodes = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return episodes,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && is_video_file(&path) {
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let file_path = path.to_string_lossy().to_string();
            episodes.push(EpisodeFile {
                file_name,
                file_path,
            });
        }
    }

    episodes.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    episodes
}

/// Scans a single anime series folder.
/// Handles both flat (episodes directly inside) and
/// nested (Season 1/, Season 2/ subfolders) structures.
fn scan_series_folder(series_path: &Path) -> Option<DiscoveredSeries> {
    let name = series_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut seasons: Vec<Season> = Vec::new();
    let mut all_episodes: Vec<EpisodeFile> = Vec::new();

    let entries = match std::fs::read_dir(series_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    // Check what's directly inside this folder
    let mut has_season_folders = false;

    for entry in entries.flatten() {
        let path = entry.path();
        let entry_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if path.is_dir() && is_season_folder(&entry_name) {
            // This is a Season X subfolder
            has_season_folders = true;
            let episodes = collect_episodes_in_dir(&path);

            if !episodes.is_empty() {
                all_episodes.extend(episodes.iter().map(|e| EpisodeFile {
                    file_name: e.file_name.clone(),
                    file_path: e.file_path.clone(),
                }));

                seasons.push(Season {
                    season_name: entry_name,
                    path: path.to_string_lossy().to_string(),
                    episode_files: episodes,
                });
            }
        }
    }

    // If no season folders found, treat root as flat (single season)
    if !has_season_folders {
        let episodes = collect_episodes_in_dir(series_path);
        if episodes.is_empty() {
            return None; // Skip folders with no video files at all
        }
        all_episodes = episodes
            .iter()
            .map(|e| EpisodeFile {
                file_name: e.file_name.clone(),
                file_path: e.file_path.clone(),
            })
            .collect();

        seasons.push(Season {
            season_name: "Season 1".to_string(),
            path: series_path.to_string_lossy().to_string(),
            episode_files: episodes,
        });
    }

    // Sort seasons naturally (Season 1, Season 2 ... Season 10)
    seasons.sort_by(|a, b| {
        let num_a = extract_season_number(&a.season_name);
        let num_b = extract_season_number(&b.season_name);
        num_a.cmp(&num_b)
    });

    all_episodes.sort_by(|a, b| a.file_name.cmp(&b.file_name));

    Some(DiscoveredSeries {
        name,
        path: series_path.to_string_lossy().to_string(),
        episode_files: all_episodes,
        seasons,
    })
}

/// Extracts the number from "Season 1", "S01" etc. for natural sorting
fn extract_season_number(name: &str) -> u32 {
    let lower = name.to_lowercase();
    let digits: String = lower
        .trim_start_matches("season")
        .trim_start_matches('s')
        .trim()
        .chars()
        .filter(|c| c.is_numeric())
        .collect();

    digits.parse().unwrap_or(0)
}

/// Main entry point — scans the root anime folder
/// Each immediate subfolder is treated as a separate anime series
pub fn scan_folder(root_path: &str) -> Vec<DiscoveredSeries> {
    let root = Path::new(root_path);

    if !root.exists() || !root.is_dir() {
        return vec![];
    }

    let entries = match std::fs::read_dir(root) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut series_list: Vec<DiscoveredSeries> = entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| scan_series_folder(&e.path()))
        .collect();

    series_list.sort_by(|a, b| a.name.cmp(&b.name));
    series_list
}
