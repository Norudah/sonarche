//! Sonarche's own database (`sonarche.db`): download history, import
//! archive, artist images, playlists (queried from `crate::playlists`).
//!
//! Boundary rule: facts about audio files and their tags belong to beets;
//! what the app or the user did belongs here. Library data is never mirrored.
//! Opaque payloads (`report`) are JSON text; scalar fields get real columns.

pub mod artist_images;
#[cfg(test)]
pub(crate) mod fixtures;
pub mod imports;
pub mod jobs;
pub mod playlists;

use std::path::Path;

use rusqlite::Connection;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};

/// Informational only: nothing branches on it (see `open()`).
const SCHEMA_VERSION: i64 = 8;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    kind        TEXT NOT NULL,
    status      TEXT NOT NULL,
    failed_step TEXT,
    error       TEXT,
    title       TEXT,
    artist      TEXT,
    thumbnail   TEXT,
    duration    REAL,
    staged_path TEXT,
    item_id     INTEGER,
    report      TEXT,
    download_attempts INTEGER NOT NULL DEFAULT 0,
    -- The category the user picked at enqueue time (beets' grouping tag),
    -- applied to every item the job produces once enrich is through. NULL means
    -- leave it alone, which is what every job written before this existed did.
    category    TEXT,
    -- The album the user forced this playlist into, as JSON ({title, artist}).
    -- NULL is the normal path: let the pipeline decide what album this is.
    forced_album TEXT,
    -- One record for the whole playlist (the single-album option), on by
    -- default: the auto pipeline must not scatter a set across releases.
    single_album INTEGER NOT NULL DEFAULT 1,
    -- Playlist slots skipped at probe time because their video was deleted,
    -- private or claimed: the job's downloads mirror the playable playlist.
    unavailable INTEGER NOT NULL DEFAULT 0,
    -- When the job's library output was taken back out. NULL for a job that
    -- stands; a set value is what stops a second undo.
    undone_at   INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job_tracks (
    job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    idx          INTEGER NOT NULL,
    video_id     TEXT NOT NULL,
    url          TEXT NOT NULL,
    title        TEXT,
    duration     REAL,
    status       TEXT NOT NULL,
    error        TEXT,
    staged_path  TEXT,
    item_id      INTEGER,
    report       TEXT,
    duplicate_of INTEGER,
    download_attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (job_id, idx)
);

-- One row per *finished* library import. Nothing is written while one runs: the
-- page running it shows a live card, and a row left at \"running\" because the app
-- was closed mid-copy is a claim the archive could never retract.
--
-- The scan's counts are kept alongside the outcome so a row can say what was
-- asked of the import and not only what came back — and `recap` holds the state
-- of the tags that arrived, as JSON, because its shape belongs to the sidecar
-- (see sidecar/import_recap.py) and Rust has no reason to know it.
CREATE TABLE IF NOT EXISTS imports (
    id            TEXT PRIMARY KEY,
    folder        TEXT NOT NULL,
    status        TEXT NOT NULL,
    error         TEXT,
    playable      INTEGER NOT NULL DEFAULT 0,
    unplayable    INTEGER NOT NULL DEFAULT 0,
    unplayable_by_extension TEXT,
    bytes         INTEGER NOT NULL DEFAULT 0,
    album_folders INTEGER NOT NULL DEFAULT 0,
    folders       INTEGER NOT NULL DEFAULT 0,
    renditions    INTEGER NOT NULL DEFAULT 0,
    recap         TEXT,
    -- What the run was told to do. Kept because it is the first thing anyone
    -- asks of a result they do not recognise: an archive that reports what
    -- landed without what was asked cannot answer whether the wrong one was
    -- picked.
    grouping      TEXT,
    category      TEXT,
    -- When the import was taken back out of the library, NULL while it stands.
    -- The row is kept rather than deleted: the archive says what happened, and
    -- an import that was undone happened twice.
    undone_at     INTEGER,
    finished_at   INTEGER NOT NULL
);

-- The image an artist wears in the interface. An artist is an entity nowhere
-- else — no beets table, no folder, no audio tag — so this row IS the artist's
-- existence as far as images go. `name` is the exact albumartist string the
-- front groups on; `filename` lives under the library's `Artwork/Artists/`
-- and is the artist's readable name (the front cache-busts on `updated_at`).
-- `source` says where the picture came from (today: local).
CREATE TABLE IF NOT EXISTS artist_images (
    name       TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    source     TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- A user-curated playlist: the exact kind of \"user collection\" this store was
-- opened for. Only the collection itself lives here — every member row points
-- at a beets item id and carries none of its tags, so library truth stays in
-- the library.
CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    -- 'user' for everything the user created; 'favorites' for the one built-in
    -- list, seeded at startup, that rename and delete refuse to touch. The
    -- front shows it under a localized label, so the stored name is not UI.
    kind       TEXT NOT NULL DEFAULT 'user',
    -- Filename of a user-chosen tile under the library's `Artwork/Playlists/`
    -- (named after the playlist, like artist images). NULL draws the cover
    -- mosaic instead.
    cover      TEXT,
    -- What the playlist wears in the navigation: 'icon:<key>' from the front's
    -- curated set, 'cover' for a thumbnail of its own tile, or 'color:<key>'
    -- from the theme palette. NULL means the front decides (its default glyph).
    -- Stored as opaque text: the shape is validated, the keys are not, so a
    -- front that adds an icon needs no migration and an older build simply
    -- falls back to the default.
    marker     TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Membership, ordered. `position` is dense (0..n-1, rewritten wholesale on any
-- reorder/removal — a playlist is small enough that correctness beats clever
-- gap schemes). `item_id` is a beets `items.id`; it cannot be a foreign key
-- (other database file), so `delete_track` prunes memberships best-effort and
-- the front drops any id the library no longer answers for.
CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    item_id     INTEGER NOT NULL,
    added_at    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, position)
);

-- Read path ordering + the queryable columns future features (retry-all,
-- URL/video dedup at enqueue, per-item lookup) will index against.
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_item ON playlist_tracks(item_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_finished ON imports(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_url     ON jobs(url);
CREATE INDEX IF NOT EXISTS idx_tracks_item  ON job_tracks(item_id);
";

/// Opens (or creates) the DB and applies the schema. WAL keeps the worker's
/// writes from blocking command reads.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    // Before any pragma: switching to WAL needs an exclusive lock, which the
    // previous instance may still hold while it exits (relaunch after an erase).
    conn.busy_timeout(std::time::Duration::from_secs(10))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(SCHEMA)?;
    // Unconditional: every step is idempotent, and gating on the version would
    // skip steps added without a version bump.
    migrate(&conn)?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(conn)
}

/// `CREATE TABLE IF NOT EXISTS` never adds columns to an existing table, so
/// each step here is idempotent rather than keyed on a version.
fn migrate(conn: &Connection) -> AppResult<()> {
    add_column(
        conn,
        "jobs",
        "download_attempts",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column(
        conn,
        "job_tracks",
        "download_attempts",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column(conn, "jobs", "category", "TEXT")?;
    add_column(conn, "jobs", "forced_album", "TEXT")?;
    add_column(conn, "jobs", "single_album", "INTEGER NOT NULL DEFAULT 1")?;
    add_column(conn, "jobs", "unavailable", "INTEGER NOT NULL DEFAULT 0")?;
    add_column(conn, "playlists", "kind", "TEXT NOT NULL DEFAULT 'user'")?;
    add_column(conn, "playlists", "cover", "TEXT")?;
    add_column(conn, "playlists", "marker", "TEXT")?;
    add_column(conn, "imports", "grouping", "TEXT")?;
    add_column(conn, "imports", "category", "TEXT")?;
    add_column(conn, "imports", "undone_at", "INTEGER")?;
    add_column(conn, "jobs", "undone_at", "INTEGER")?;
    Ok(())
}

fn add_column(conn: &Connection, table: &str, column: &str, decl: &str) -> AppResult<()> {
    let exists = conn
        .prepare(&format!("PRAGMA table_info({table})"))?
        .query_map([], |row| row.get::<_, String>("name"))?
        .collect::<Result<Vec<_>, _>>()?
        .iter()
        .any(|name| name == column);
    if !exists {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"),
            [],
        )?;
    }
    Ok(())
}

/// Via serde_json, so DB text and wire format never drift.
fn enum_to_text<T: Serialize>(value: &T) -> AppResult<String> {
    match serde_json::to_value(value)? {
        Value::String(s) => Ok(s),
        other => Err(AppError::Sidecar(format!(
            "expected a string-valued enum, got {other}"
        ))),
    }
}

fn enum_from_text<T: DeserializeOwned>(text: &str) -> AppResult<T> {
    Ok(serde_json::from_value(Value::String(text.to_string()))?)
}

fn report_to_text(report: &Option<Value>) -> AppResult<Option<String>> {
    report
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(AppError::from)
}

fn report_from_text(text: Option<String>) -> AppResult<Option<Value>> {
    text.map(|s| serde_json::from_str(&s))
        .transpose()
        .map_err(AppError::from)
}

/// Deletes finished jobs (tracks cascade) and the import archive, in one
/// transaction. Running jobs stay.
pub fn clear_history(conn: &Connection) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM jobs WHERE status IN ('done', 'failed', 'cancelled')",
        [],
    )?;
    tx.execute("DELETE FROM imports", [])?;
    tx.commit()?;
    Ok(())
}

/// In-memory connection with the full schema, for tests here and in siblings.
#[cfg(test)]
pub fn open_in_memory_for_tests() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory db");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("foreign_keys pragma");
    conn.execute_batch(SCHEMA).expect("schema");
    conn
}

#[cfg(test)]
mod tests {
    use super::fixtures::{import, single, track};
    use super::imports::{insert_import, list_imports};
    use super::jobs::{list_live_jobs, upsert_job, LIVE_TERMINAL_WINDOW};
    use super::*;
    use crate::jobs::{JobKind, JobStatus, TrackStatus};

    fn mem() -> Connection {
        open_in_memory_for_tests()
    }

    /// Tables as written by an older build, before `download_attempts`.
    const SCHEMA_V1: &str = "
    CREATE TABLE jobs (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, kind TEXT NOT NULL,
        status TEXT NOT NULL, failed_step TEXT, error TEXT, title TEXT,
        artist TEXT, thumbnail TEXT, duration REAL, staged_path TEXT,
        item_id INTEGER, report TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE job_tracks (
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        idx INTEGER NOT NULL, video_id TEXT NOT NULL, url TEXT NOT NULL,
        title TEXT, duration REAL, status TEXT NOT NULL, error TEXT,
        staged_path TEXT, item_id INTEGER, report TEXT, duplicate_of INTEGER,
        PRIMARY KEY (job_id, idx)
    );";

    fn column_names(conn: &Connection, table: &str) -> Vec<String> {
        conn.prepare(&format!("PRAGMA table_info({table})"))
            .unwrap()
            .query_map([], |row| row.get::<_, String>("name"))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    /// Replays `open()`: SCHEMA first, then the migration under test.
    fn migrate_v1(conn: &Connection) {
        conn.execute_batch(SCHEMA).unwrap();
        migrate(conn).unwrap();
    }

    #[test]
    fn migrate_adds_the_attempts_columns_to_a_v1_file() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_V1).unwrap();
        assert!(!column_names(&conn, "jobs").contains(&"download_attempts".to_string()));

        migrate_v1(&conn);

        for table in ["jobs", "job_tracks"] {
            assert!(
                column_names(&conn, table).contains(&"download_attempts".to_string()),
                "{table} still lacks download_attempts"
            );
        }
    }

    #[test]
    fn migrate_adds_the_category_column_to_an_older_file() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_V1).unwrap();
        assert!(!column_names(&conn, "jobs").contains(&"category".to_string()));

        migrate_v1(&conn);

        assert!(column_names(&conn, "jobs").contains(&"category".to_string()));
    }

    /// A file stamped with the current version but an old schema must still be
    /// migrated.
    #[test]
    fn opening_an_old_file_migrates_it_however_it_is_stamped() {
        let path = std::env::temp_dir().join(format!("sonarche-migrate-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);

        {
            let old = Connection::open(&path).unwrap();
            old.execute_batch(SCHEMA_V1).unwrap();
            old.pragma_update(None, "user_version", SCHEMA_VERSION)
                .unwrap();
        }

        let conn = open(&path).unwrap();

        for column in [
            "download_attempts",
            "category",
            "forced_album",
            "unavailable",
        ] {
            assert!(
                column_names(&conn, "jobs").contains(&column.to_string()),
                "{column} missing after opening an older file"
            );
        }
        drop(conn);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn migrate_adds_the_forced_album_column_to_an_older_file() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_V1).unwrap();
        assert!(!column_names(&conn, "jobs").contains(&"forced_album".to_string()));

        migrate_v1(&conn);

        assert!(column_names(&conn, "jobs").contains(&"forced_album".to_string()));
    }

    #[test]
    fn migrate_is_idempotent_on_a_current_file() {
        // A fresh file has the column but is stamped 0; the migration must not fail.
        let conn = mem();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        assert_eq!(
            column_names(&conn, "jobs")
                .iter()
                .filter(|name| *name == "download_attempts")
                .count(),
            1
        );
    }

    #[test]
    fn clear_history_keeps_in_flight_and_cascades_tracks() {
        let conn = mem();
        let mut album = single("g", JobStatus::Done);
        album.kind = JobKind::Album;
        album.tracks = vec![track(1, TrackStatus::Done)];
        upsert_job(&conn, &album).unwrap();
        upsert_job(&conn, &single("h", JobStatus::Failed)).unwrap();
        upsert_job(&conn, &single("h2", JobStatus::Cancelled)).unwrap();
        upsert_job(&conn, &single("i", JobStatus::Downloading)).unwrap();

        clear_history(&conn).unwrap();

        let remaining: Vec<String> = list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .into_iter()
            .map(|j| j.id)
            .collect();
        assert_eq!(remaining, vec!["i".to_string()]);
        let orphan_tracks: i64 = conn
            .query_row("SELECT COUNT(*) FROM job_tracks", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphan_tracks, 0);
    }

    #[test]
    fn clear_history_empties_both_archives() {
        let conn = mem();
        upsert_job(&conn, &single("j", JobStatus::Done)).unwrap();
        insert_import(&conn, &import("i", 100)).unwrap();

        clear_history(&conn).unwrap();

        assert!(list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .is_empty());
        assert!(list_imports(&conn).unwrap().is_empty());
    }
}
