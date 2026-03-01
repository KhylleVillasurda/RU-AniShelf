use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Returns the path where the database file will be stored.
/// On Windows this resolves to: C:\Users\<You>\AppData\Roaming\ru-anishelf\anishelf.db
pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().expect("Could not find app data directory");
    path.push("ru-anishelf");
    path.push("anishelf.db");
    path
}

/// Creates the database file and all tables if they don't exist yet.
/// Safe to call every time the app starts — IF NOT EXISTS means it
/// won't wipe your data on restart.
pub fn initialize_db() -> Result<Connection> {
    let db_path = get_db_path();

    // Create the folder if it doesn't exist yet
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
            series_id       INTEGER NOT NULL,
            episode_number  INTEGER NOT NULL,
            watched_at      TEXT NOT NULL,
            FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key    TEXT PRIMARY KEY,
            value  TEXT NOT NULL
        );
    ",
    )?;

    Ok(conn)
}
