use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().expect("Could not find app data directory");
    path.push("ru-anishelf");
    path.push("anishelf.db");
    path
}

pub fn initialize_db() -> Result<Connection> {
    let db_path = get_db_path();

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create app data directory");
    }

    let conn = Connection::open(&db_path)?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS series (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            title             TEXT NOT NULL,
            title_english     TEXT,
            title_native      TEXT,
            local_path        TEXT NOT NULL,
            cover_local_path  TEXT,
            cover_remote_url  TEXT,
            synopsis          TEXT,
            episode_count     INTEGER,
            status            TEXT NOT NULL DEFAULT 'plan_to_watch',
            anilist_id        INTEGER,
            mal_id            INTEGER,
            anilist_score     REAL,
            mal_score         REAL,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            series_id       INTEGER NOT NULL,
            episode_number  INTEGER NOT NULL,
            file_path       TEXT NOT NULL,
            file_name       TEXT,
            watched         INTEGER NOT NULL DEFAULT 0,
            watched_at      TEXT,
            FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS genres (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS series_genres (
            series_id  INTEGER NOT NULL,
            genre_id   INTEGER NOT NULL,
            FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
            FOREIGN KEY (genre_id)  REFERENCES genres(id) ON DELETE CASCADE,
            PRIMARY KEY (series_id, genre_id)
        );

        CREATE TABLE IF NOT EXISTS watch_history (
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

        CREATE TABLE IF NOT EXISTS settings (
            key    TEXT PRIMARY KEY,
            value  TEXT NOT NULL
        );
    ",
    )?;

    Ok(conn)
}

/// Saves a watch event to the history table
pub fn save_watch_event(
    conn: &Connection,
    series_name: &str,
    series_path: &str,
    cover_url: Option<&str>,
    episode_name: &str,
    episode_path: &str,
    episode_number: i32,
    season_name: &str,
) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO watch_history
            (series_name, series_path, cover_url, episode_name,
             episode_path, episode_number, season_name, watched_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            series_name,
            series_path,
            cover_url,
            episode_name,
            episode_path,
            episode_number,
            season_name,
            now
        ],
    )?;
    Ok(())
}

/// Returns the most recent watch events
pub fn get_watch_history(conn: &Connection, limit: i32) -> Result<Vec<WatchEvent>> {
    let mut stmt = conn.prepare(
        "SELECT series_name, series_path, cover_url, episode_name,
                episode_path, episode_number, season_name, watched_at
         FROM watch_history
         ORDER BY watched_at DESC
         LIMIT ?1",
    )?;

    let events = stmt
        .query_map([limit], |row| {
            Ok(WatchEvent {
                series_name: row.get(0)?,
                series_path: row.get(1)?,
                cover_url: row.get(2)?,
                episode_name: row.get(3)?,
                episode_path: row.get(4)?,
                episode_number: row.get(5)?,
                season_name: row.get(6)?,
                watched_at: row.get(7)?,
            })
        })?
        .flatten()
        .collect();

    Ok(events)
}

/// Struct representing a single watch history entry
#[derive(Debug)]
pub struct WatchEvent {
    pub series_name: String,
    pub series_path: String,
    pub cover_url: Option<String>,
    pub episode_name: String,
    pub episode_path: String,
    pub episode_number: i32,
    pub season_name: String,
    pub watched_at: String,
}

// Saves a key-value setting to the settings table
pub fn save_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

// Reads a setting by key, returns None if not found
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;

    let result = stmt.query_row([key], |row| row.get(0));

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn clear_watch_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM watch_history", [])?;
    Ok(())
}
