use rusqlite::{Connection, OptionalExtension, Result};
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
            anilist_id        INTEGER UNIQUE,
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
            season_name     TEXT NOT NULL DEFAULT 'Season 1',
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

        CREATE TABLE IF NOT EXISTS library_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );
    ",
    )?;

    Ok(conn)
}
//============================================================ EPISODE WATCH RELATED FUNCTIONS ============================================================
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

pub fn clear_watch_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM watch_history", [])?;
    Ok(())
}

pub fn upsert_series(
    conn: &Connection,
    title: &str,
    title_english: Option<&str>,
    title_native: Option<&str>,
    local_path: &str,
    cover_local_path: Option<&str>,
    cover_remote_url: Option<&str>,
    synopsis: Option<&str>,
    episode_count: Option<i32>,
    status: &str,
    anilist_id: Option<i64>,
    anilist_score: Option<f64>,
    genres: &[String],
) -> Result<i64> {
    let now = chrono::Utc::now().to_rfc3339();

    // Check if series already exists by local_path — this is our stable key
    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM series WHERE local_path = ?1",
            [local_path],
            |row| row.get(0),
        )
        .optional()?;

    let series_id = if let Some(id) = existing_id {
        // Clear conflicting anilist_id from any OTHER row first
        // This prevents UNIQUE constraint failures when anilist result changes
        if let Some(aid) = anilist_id {
            conn.execute(
                "UPDATE series SET anilist_id = NULL 
             WHERE anilist_id = ?1 AND id != ?2",
                rusqlite::params![aid, id], // ← use id not local_path
            )?;
        }

        conn.execute(
            "UPDATE series SET
            title = ?1,
            title_english = ?2,
            title_native = ?3,
            cover_local_path = ?4,
            cover_remote_url = ?5,
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
                cover_local_path,
                cover_remote_url,
                synopsis,
                episode_count,
                anilist_id,
                anilist_score,
                now,
                id,
            ],
        )?;
        id
    } else {
        // Clear conflicting anilist_id from any row first
        if let Some(aid) = anilist_id {
            conn.execute(
                "UPDATE series SET anilist_id = NULL 
             WHERE anilist_id = ?1",
                [aid],
            )?;
        }
        conn.execute(
            "INSERT INTO series (
                title, title_english, title_native, local_path,
                cover_local_path, cover_remote_url, synopsis,
                episode_count, status, anilist_id, anilist_score,
                created_at, updated_at
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)",
            rusqlite::params![
                title,
                title_english,
                title_native,
                local_path,
                cover_local_path,
                cover_remote_url,
                synopsis,
                episode_count,
                status,
                anilist_id,
                anilist_score,
                now,
            ],
        )?;
        conn.last_insert_rowid()
    };

    // Clear and reinsert genres
    conn.execute(
        "DELETE FROM series_genres WHERE series_id = ?1",
        [series_id],
    )?;

    for genre in genres {
        conn.execute("INSERT OR IGNORE INTO genres (name) VALUES (?1)", [genre])?;
        let genre_id: i64 =
            conn.query_row("SELECT id FROM genres WHERE name = ?1", [genre], |row| {
                row.get(0)
            })?;
        conn.execute(
            "INSERT OR IGNORE INTO series_genres (series_id, genre_id)
             VALUES (?1, ?2)",
            rusqlite::params![series_id, genre_id],
        )?;
    }

    Ok(series_id)
}

/// Loads all series from the database with their genres
pub fn get_all_series(conn: &Connection) -> Result<Vec<SeriesRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, title_english, title_native, local_path,
                cover_local_path, cover_remote_url, synopsis,
                episode_count, status, anilist_id, mal_id, anilist_score
         FROM series
         ORDER BY title ASC",
    )?;

    let series_list: Vec<SeriesRecord> = stmt
        .query_map([], |row| {
            Ok(SeriesRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                title_english: row.get(2)?,
                title_native: row.get(3)?,
                local_path: row.get(4)?,
                cover_local_path: row.get(5)?,
                cover_remote_url: row.get(6)?,
                synopsis: row.get(7)?,
                episode_count: row.get(8)?,
                status: row.get(9)?,
                anilist_id: row.get(10)?,
                mal_id: row.get(11)?,
                anilist_score: row.get(12)?,
                genres: vec![], // filled below
            })
        })?
        .flatten()
        .collect();

    // Load genres for each series
    let mut result = Vec::new();
    for mut series in series_list {
        let mut genre_stmt = conn.prepare(
            "SELECT g.name FROM genres g
             JOIN series_genres sg ON sg.genre_id = g.id
             WHERE sg.series_id = ?1",
        )?;
        series.genres = genre_stmt
            .query_map([series.id], |row| row.get(0))?
            .flatten()
            .collect();
        result.push(series);
    }

    Ok(result)
}

/// Checks if a series already exists in the DB by local path
#[allow(dead_code)]
pub fn series_exists(conn: &Connection, local_path: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM series WHERE local_path = ?1",
        [local_path],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Updates the status of a series
pub fn update_series_status(conn: &Connection, series_id: i64, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE series SET status = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![status, chrono::Utc::now().to_rfc3339(), series_id],
    )?;
    Ok(())
}

/// Saves episode files for a series — clears old ones first
pub fn save_episodes(
    conn: &Connection,
    series_id: i64,
    episodes: &[(i32, &str, &str, &str)], // (number, file_path, file_name, season_name)
) -> Result<()> {
    // Clear existing episodes for this series
    conn.execute("DELETE FROM episodes WHERE series_id = ?1", [series_id])?;

    for (episode_number, file_path, file_name, season_name) in episodes {
        conn.execute(
            "INSERT INTO episodes
                (series_id, episode_number, file_path, file_name, season_name)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![series_id, episode_number, file_path, file_name, season_name],
        )?;
    }

    Ok(())
}

/// Loads all episodes for a series grouped by season
pub fn get_episodes(conn: &Connection, series_id: i64) -> Result<Vec<EpisodeRecord>> {
    let mut stmt = conn.prepare(
        "SELECT episode_number, file_path, file_name, season_name
         FROM episodes
         WHERE series_id = ?1
         ORDER BY season_name ASC, episode_number ASC",
    )?;

    let episodes = stmt
        .query_map([series_id], |row| {
            Ok(EpisodeRecord {
                episode_number: row.get(0)?,
                file_path: row.get(1)?,
                file_name: row.get(2)?,
                season_name: row.get(3)?,
            })
        })?
        .flatten()
        .collect();

    Ok(episodes)
}

#[derive(Debug)]
pub struct SeriesRecord {
    pub id: i64,
    pub title: String,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub local_path: String,
    pub cover_local_path: Option<String>,
    pub cover_remote_url: Option<String>,
    pub synopsis: Option<String>,
    pub episode_count: Option<i32>,
    pub status: String,
    pub anilist_id: Option<i64>,
    #[allow(dead_code)]
    pub mal_id: Option<i64>,
    pub anilist_score: Option<f64>,
    pub genres: Vec<String>,
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

#[derive(Debug)]
pub struct EpisodeRecord {
    pub episode_number: i32,
    pub file_path: String,
    pub file_name: String,
    pub season_name: String,
}

//============================================================ SETTINGS FUNCTIONS ============================================================
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
