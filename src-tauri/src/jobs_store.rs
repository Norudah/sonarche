//! Sonarche's application database (`sonarche.db`).
//!
//! This is the app's OWN store, deliberately separate from the beets library —
//! beets (its own SQLite) stays the single source of truth for the music and its
//! metadata; this DB never mirrors it. It holds Sonarche's operational and
//! application state: today the download history, later anything that is app/user
//! state rather than a fact about an audio file (e.g. a download ledger for
//! dedup, user collections, play state). The boundary rule: if it's "facts about
//! the audio and its tags" it belongs to beets; if it's "what Sonarche/the user
//! did" it belongs here — never duplicate library truth into this file.
//!
//! History tables: `jobs` (one row per download) and `job_tracks` (album playlist
//! entries). Nested/opaque payloads (`report`) are stored as JSON text; scalar
//! fields get real columns so history stays queryable and indexable as features
//! grow. `PRAGMA user_version` carries the schema version for future migrations.

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::jobs::{AlbumTrack, Job};
use crate::library_import::{ImportRecord, ScanCounts};

/// Schema version stamped into `PRAGMA user_version`. Informational: it records
/// which build last touched the file. Nothing branches on it — see `open()`.
const SCHEMA_VERSION: i64 = 7;

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
    -- Playlist slots skipped at probe time because their video was deleted,
    -- private or claimed: the job's downloads mirror the playable playlist.
    unavailable INTEGER NOT NULL DEFAULT 0,
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

/// Open (creating if needed) the history DB and ensure the schema is present.
/// WAL keeps the worker's writes from blocking concurrent command reads.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    // Before any pragma. The WAL switch below needs an exclusive lock, and
    // there is one ordinary moment when another process holds the file: the
    // relaunch after an erase, where the dying instance is still running its
    // closing checkpoint. Without a timeout that open returned SQLITE_BUSY
    // immediately, the setup hook failed, and tauri's "Failed to setup app"
    // panic aborted the fresh instance before it drew a window.
    conn.busy_timeout(std::time::Duration::from_secs(10))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(SCHEMA)?;
    // Unconditional, deliberately. This used to run only when the file was
    // stamped below SCHEMA_VERSION, which meant a migration step added without
    // bumping the constant never reached a single existing install: the column
    // stayed missing and the first write failed with "table jobs has no column
    // named …". Every step is idempotent (`add_column` checks first), so the
    // gate bought nothing but that failure mode.
    migrate(&conn)?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(conn)
}

/// `CREATE TABLE IF NOT EXISTS` leaves an existing table exactly as it was, so
/// columns added to SCHEMA never reach a file created by an older build. Each
/// step is written to be idempotent rather than keyed on the version it came
/// from: a fresh file is created at SCHEMA_VERSION but still stamped 0, so it
/// runs through here too.
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
    add_column(conn, "jobs", "unavailable", "INTEGER NOT NULL DEFAULT 0")?;
    add_column(conn, "playlists", "kind", "TEXT NOT NULL DEFAULT 'user'")?;
    add_column(conn, "playlists", "cover", "TEXT")?;
    add_column(conn, "playlists", "marker", "TEXT")?;
    // Runs archived before the import had options carry neither: they were all
    // made under the one behaviour beets has by default.
    add_column(conn, "imports", "grouping", "TEXT")?;
    add_column(conn, "imports", "category", "TEXT")?;
    // When the run was taken back out. NULL for every row that still stands,
    // which is what an older file's rows are.
    add_column(conn, "imports", "undone_at", "INTEGER")?;
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

/// The enums all serialize to a lowercase string via serde; round-trip through
/// serde_json so the DB text and the wire format never drift.
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

fn row_to_job(row: &Row) -> AppResult<Job> {
    Ok(Job {
        id: row.get("id")?,
        url: row.get("url")?,
        kind: enum_from_text(&row.get::<_, String>("kind")?)?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        failed_step: row
            .get::<_, Option<String>>("failed_step")?
            .map(|s| enum_from_text(&s))
            .transpose()?,
        error: row.get("error")?,
        title: row.get("title")?,
        artist: row.get("artist")?,
        thumbnail: row.get("thumbnail")?,
        duration: row.get("duration")?,
        staged_path: row.get("staged_path")?,
        item_id: row.get("item_id")?,
        report: report_from_text(row.get("report")?)?,
        tracks: Vec::new(),
        download_attempts: row.get::<_, i64>("download_attempts")? as u32,
        category: row.get("category")?,
        forced_album: row
            .get::<_, Option<String>>("forced_album")?
            .map(|text| serde_json::from_str(&text))
            .transpose()
            .map_err(|e| AppError::Sidecar(format!("bad forced_album json: {e}")))?,
        unavailable: row.get::<_, i64>("unavailable")? as u32,
        created_at: row.get::<_, i64>("created_at")? as u64,
        updated_at: row.get::<_, i64>("updated_at")? as u64,
    })
}

fn row_to_track(row: &Row) -> AppResult<AlbumTrack> {
    Ok(AlbumTrack {
        index: row.get::<_, i64>("idx")? as u32,
        video_id: row.get("video_id")?,
        url: row.get("url")?,
        title: row.get("title")?,
        duration: row.get("duration")?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        error: row.get("error")?,
        staged_path: row.get("staged_path")?,
        item_id: row.get("item_id")?,
        report: report_from_text(row.get("report")?)?,
        duplicate_of: row.get("duplicate_of")?,
        download_attempts: row.get::<_, i64>("download_attempts")? as u32,
    })
}

fn write_job_row(conn: &Connection, job: &Job) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO jobs (
            id, url, kind, status, failed_step, error, title, artist, thumbnail,
            duration, staged_path, item_id, report, download_attempts, category,
            forced_album, unavailable, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
        params![
            job.id,
            job.url,
            enum_to_text(&job.kind)?,
            enum_to_text(&job.status)?,
            job.failed_step.map(|s| enum_to_text(&s)).transpose()?,
            job.error,
            job.title,
            job.artist,
            job.thumbnail,
            job.duration,
            job.staged_path,
            job.item_id,
            report_to_text(&job.report)?,
            job.download_attempts as i64,
            job.category,
            job.forced_album
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|e| AppError::Sidecar(format!("forced_album not serializable: {e}")))?,
            job.unavailable as i64,
            job.created_at as i64,
            job.updated_at as i64,
        ],
    )?;
    Ok(())
}

fn write_track_row(conn: &Connection, job_id: &str, track: &AlbumTrack) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO job_tracks (
            job_id, idx, video_id, url, title, duration, status, error,
            staged_path, item_id, report, duplicate_of, download_attempts
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            job_id,
            track.index as i64,
            track.video_id,
            track.url,
            track.title,
            track.duration,
            enum_to_text(&track.status)?,
            track.error,
            track.staged_path,
            track.item_id,
            report_to_text(&track.report)?,
            track.duplicate_of,
            track.download_attempts as i64,
        ],
    )?;
    Ok(())
}

/// Full write of a job and all its tracks, in one transaction. Used whenever a
/// mutation may have touched job-level fields or several tracks at once.
pub fn upsert_job(conn: &Connection, job: &Job) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    write_job_row(&tx, job)?;
    tx.execute("DELETE FROM job_tracks WHERE job_id = ?1", params![job.id])?;
    for track in &job.tracks {
        write_track_row(&tx, &job.id, track)?;
    }
    tx.commit()?;
    Ok(())
}

/// Targeted write of a single track plus the parent job's `updated_at`. The hot
/// path during an album download: one row touched per transition, not the whole
/// playlist.
pub fn update_track(
    conn: &Connection,
    job_id: &str,
    updated_at: u64,
    track: &AlbumTrack,
) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    write_track_row(&tx, job_id, track)?;
    tx.execute(
        "UPDATE jobs SET updated_at = ?2 WHERE id = ?1",
        params![job_id, updated_at as i64],
    )?;
    tx.commit()?;
    Ok(())
}

fn load_tracks(conn: &Connection, job_id: &str) -> AppResult<Vec<AlbumTrack>> {
    let mut stmt = conn.prepare("SELECT * FROM job_tracks WHERE job_id = ?1 ORDER BY idx ASC")?;
    let rows = stmt.query_map(params![job_id], |row| Ok(row_to_track(row)))?;
    let mut tracks = Vec::new();
    for row in rows {
        tracks.push(row??);
    }
    Ok(tracks)
}

pub fn get_job(conn: &Connection, id: &str) -> AppResult<Option<Job>> {
    let mut job = conn
        .query_row("SELECT * FROM jobs WHERE id = ?1", params![id], |row| {
            Ok(row_to_job(row))
        })
        .optional()?
        .transpose()?;
    if let Some(job) = job.as_mut() {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    Ok(job)
}

/// Terminal statuses as SQL — the archive; everything else is the live queue.
/// One list, shared by every read that carves the two apart.
const TERMINAL_STATUSES: &str = "('done', 'failed', 'cancelled')";

/// How many terminal jobs ride along with the live queue: enough for the
/// Downloads page's "recent" strip with slack, small enough that launch never
/// pays for months of history. The archive is `list_jobs_page`'s business.
pub const LIVE_TERMINAL_WINDOW: u32 = 50;

/// The live window, newest first, tracks attached: every job still moving —
/// however old, a retried failure must not vanish — plus the most recent
/// terminal ones. The one extra query per job to gather tracks is bounded by
/// the window.
pub fn list_live_jobs(conn: &Connection, recent_terminal: u32) -> AppResult<Vec<Job>> {
    let sql = format!(
        "SELECT * FROM jobs
         WHERE status NOT IN {TERMINAL_STATUSES}
            OR id IN (SELECT id FROM jobs WHERE status IN {TERMINAL_STATUSES}
                      ORDER BY created_at DESC LIMIT ?1)
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![recent_terminal], |row| Ok(row_to_job(row)))?;
    let mut jobs = Vec::new();
    for row in rows {
        jobs.push(row??);
    }
    for job in &mut jobs {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    Ok(jobs)
}

/// One page of the whole archive — every job whatever its status, newest
/// first — plus the totals the history page paginates and counts on.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobsPage {
    pub jobs: Vec<Job>,
    /// Every job in the store, live included — what the page count divides.
    pub total: u64,
    /// Terminal jobs only — what "clear history" would sweep.
    pub terminal_total: u64,
}

pub fn list_jobs_page(conn: &Connection, offset: u64, limit: u64) -> AppResult<JobsPage> {
    let mut stmt =
        conn.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?1 OFFSET ?2")?;
    let rows = stmt.query_map(params![limit, offset], |row| Ok(row_to_job(row)))?;
    let mut jobs = Vec::new();
    for row in rows {
        jobs.push(row??);
    }
    for job in &mut jobs {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    let total = conn.query_row("SELECT COUNT(*) FROM jobs", [], |row| row.get::<_, i64>(0))? as u64;
    let terminal_total = conn.query_row(
        &format!("SELECT COUNT(*) FROM jobs WHERE status IN {TERMINAL_STATUSES}"),
        [],
        |row| row.get::<_, i64>(0),
    )? as u64;
    Ok(JobsPage {
        jobs,
        total,
        terminal_total,
    })
}

pub fn insert_import(conn: &Connection, record: &ImportRecord) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO imports (
            id, folder, status, error, playable, unplayable,
            unplayable_by_extension, bytes, album_folders, folders, renditions,
            grouping, category,
            recap, undone_at, finished_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            record.id,
            record.folder,
            enum_to_text(&record.status)?,
            record.error,
            record.scan.playable as i64,
            record.scan.unplayable as i64,
            serde_json::to_string(&record.scan.unplayable_by_extension)?,
            record.scan.bytes as i64,
            record.scan.album_folders as i64,
            record.folders as i64,
            record.renditions as i64,
            record.grouping,
            record.category,
            report_to_text(&record.recap)?,
            record.undone_at.map(|at| at as i64),
            record.finished_at as i64,
        ],
    )?;
    Ok(())
}

/// One archived import, or None when the id names nothing. The undo needs the
/// folder it read — the sidecar has to forget it from beets' incremental
/// memory, and only this row remembers which folder the run was about.
pub fn get_import(conn: &Connection, id: &str) -> AppResult<Option<ImportRecord>> {
    let mut stmt = conn.prepare("SELECT * FROM imports WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], |row| Ok(row_to_import(row)))?;
    match rows.next() {
        Some(row) => Ok(Some(row??)),
        None => Ok(None),
    }
}

/// Mark a run as taken back out. The row stays, and the history says so.
pub fn mark_import_undone(conn: &Connection, id: &str, when: u64) -> AppResult<()> {
    conn.execute(
        "UPDATE imports SET undone_at = ?2 WHERE id = ?1",
        params![id, when as i64],
    )?;
    Ok(())
}

pub fn list_imports(conn: &Connection) -> AppResult<Vec<ImportRecord>> {
    let mut stmt = conn.prepare("SELECT * FROM imports ORDER BY finished_at DESC")?;
    let rows = stmt.query_map([], |row| Ok(row_to_import(row)))?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row??);
    }
    Ok(records)
}

fn row_to_import(row: &Row) -> AppResult<ImportRecord> {
    Ok(ImportRecord {
        id: row.get("id")?,
        folder: row.get("folder")?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        error: row.get("error")?,
        scan: ScanCounts {
            playable: row.get::<_, i64>("playable")? as u64,
            unplayable: row.get::<_, i64>("unplayable")? as u64,
            unplayable_by_extension: row
                .get::<_, Option<String>>("unplayable_by_extension")?
                .and_then(|raw| serde_json::from_str(&raw).ok())
                .unwrap_or_default(),
            bytes: row.get::<_, i64>("bytes")? as u64,
            album_folders: row.get::<_, i64>("album_folders")? as u64,
        },
        folders: row.get::<_, i64>("folders")? as u64,
        renditions: row.get::<_, i64>("renditions")? as u64,
        grouping: row.get("grouping")?,
        category: row.get("category")?,
        recap: report_from_text(row.get("recap")?)?,
        undone_at: row.get::<_, Option<i64>>("undone_at")?.map(|at| at as u64),
        finished_at: row.get::<_, i64>("finished_at")? as u64,
    })
}

/// The history page's one sweep: terminal (done/failed/cancelled) jobs — their
/// tracks go with them via cascade — and the whole import archive. In-flight
/// jobs stay. One transaction, because the page shows both archives under one
/// button and a crash between the two deletes would leave it half-cleared.
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

/// One artist image row: which file (under app data's `artists/`) the named
/// artist wears. `updated_at` rides along for a future "when" in the UI.
pub struct ArtistImageRow {
    pub name: String,
    pub filename: String,
    pub updated_at: u64,
}

pub fn list_artist_images(conn: &Connection) -> AppResult<Vec<ArtistImageRow>> {
    let mut stmt =
        conn.prepare("SELECT name, filename, updated_at FROM artist_images ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(ArtistImageRow {
            name: row.get("name")?,
            filename: row.get("filename")?,
            updated_at: row.get::<_, i64>("updated_at")? as u64,
        })
    })?;
    let mut images = Vec::new();
    for row in rows {
        images.push(row?);
    }
    Ok(images)
}

/// Record the image an artist now wears. Returns the filename it replaces, if
/// any, so the caller can remove the orphaned file — the row can't, it only
/// knows names.
pub fn upsert_artist_image(
    conn: &Connection,
    name: &str,
    filename: &str,
    source: &str,
    now: u64,
) -> AppResult<Option<String>> {
    let previous: Option<String> = conn
        .query_row(
            "SELECT filename FROM artist_images WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()?;
    conn.execute(
        "INSERT OR REPLACE INTO artist_images (name, filename, source, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![name, filename, source, now as i64],
    )?;
    Ok(previous.filter(|old| old != filename))
}

/// Forget an artist's image. Returns the filename that just went ownerless.
pub fn remove_artist_image(conn: &Connection, name: &str) -> AppResult<Option<String>> {
    let filename: Option<String> = conn
        .query_row(
            "SELECT filename FROM artist_images WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()?;
    conn.execute("DELETE FROM artist_images WHERE name = ?1", params![name])?;
    Ok(filename)
}

/// Follow an albumartist rename: the image goes with the name, and since the
/// file on disk is named after the artist too, the caller renames it first
/// and passes the resulting filename here. When the new name already wears an
/// image of its own, that one wins — the rename usually merges a misspelling
/// into an artist that already exists, and their chosen picture should not be
/// overwritten by the stray's. Returns the filename left ownerless (the
/// loser's), if any, for the caller to delete.
pub fn rename_artist_image(
    conn: &Connection,
    old: &str,
    new: &str,
    filename: &str,
) -> AppResult<Option<String>> {
    if old == new {
        return Ok(None);
    }
    let target_taken: bool = conn
        .query_row(
            "SELECT 1 FROM artist_images WHERE name = ?1",
            params![new],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if target_taken {
        return remove_artist_image(conn, old);
    }
    conn.execute(
        "UPDATE artist_images SET name = ?2, filename = ?3 WHERE name = ?1",
        params![old, new, filename],
    )?;
    Ok(None)
}

/// Repoint one row at a renamed file, name untouched. The launch migration's
/// tool, as it moves the app-data era's technical names to readable ones.
pub fn update_artist_image_filename(
    conn: &Connection,
    name: &str,
    filename: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE artist_images SET filename = ?2 WHERE name = ?1",
        params![name, filename],
    )?;
    Ok(())
}

/// The erase-all sweep for artist images: every row at once. File removal is
/// the caller's job (the directory goes wholesale).
pub fn clear_artist_images(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM artist_images", [])?;
    Ok(())
}

/// Startup recovery: whatever a previous run left mid-flight is failed, and any
/// track caught downloading restarts from scratch. Returns whether anything was
/// touched (only for logging). One SQL pass, no full rewrite.
pub fn fail_interrupted(conn: &Connection, now: u64) -> AppResult<bool> {
    let jobs = conn.execute(
        "UPDATE jobs SET status = 'failed', error = 'interrupted by app restart', updated_at = ?1
         WHERE status NOT IN ('done', 'failed', 'cancelled')",
        params![now as i64],
    )?;
    conn.execute(
        "UPDATE job_tracks SET status = 'pending' WHERE status = 'downloading'",
        [],
    )?;
    Ok(jobs > 0)
}

/// One-time import of the legacy `jobs.json` history into the fresh DB.
pub fn import_jobs(conn: &Connection, jobs: &[Job]) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    for job in jobs {
        write_job_row(&tx, job)?;
        for track in &job.tracks {
            write_track_row(&tx, &job.id, track)?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// In-memory connection carrying the full schema — for this module's tests and
/// any sibling whose store functions take a `&Connection` (playlists).
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
    use super::*;
    use crate::jobs::{ForcedAlbum, JobKind, JobStatus, JobStep, TrackStatus};
    use crate::library_import::ImportStatus;
    use serde_json::json;

    fn mem() -> Connection {
        open_in_memory_for_tests()
    }

    /// The v1 tables, before `download_attempts` existed — what a file written
    /// by an older build actually looks like on disk.
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

    /// The v1 fixtures replay `open()`'s real sequence: SCHEMA first (which
    /// creates the tables a v1 file never had — playlists — and leaves the
    /// existing ones untouched), then the migration under test.
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

    /// Regression: `open()` used to migrate only when the file was stamped
    /// *below* SCHEMA_VERSION. Add a migration step without bumping the
    /// constant and no existing install ever ran it — the column stayed missing
    /// and the first write failed with "table jobs has no column named …".
    ///
    /// The stamp is deliberately the current version over an old schema, which
    /// is exactly the state that shipped: writing `SCHEMA_VERSION - 1` here
    /// would follow the bug instead of catching it, and the other migration
    /// tests call `migrate()` directly and sail straight past the gate.
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
    fn a_forced_album_survives_the_round_trip() {
        let conn = mem();
        let mut job = single("forced", JobStatus::Queued);
        job.forced_album = Some(ForcedAlbum {
            title: "Inception".into(),
            artist: Some("Hans Zimmer".into()),
        });
        upsert_job(&conn, &job).unwrap();

        let read = list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .pop()
            .unwrap();
        let forced = read.forced_album.expect("forced album lost in the store");
        assert_eq!(forced.title, "Inception");
        assert_eq!(forced.artist.as_deref(), Some("Hans Zimmer"));
    }

    #[test]
    fn a_job_written_before_forced_albums_reads_back_without_one() {
        let conn = mem();
        upsert_job(&conn, &single("plain", JobStatus::Queued)).unwrap();

        assert!(list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .pop()
            .unwrap()
            .forced_album
            .is_none());
    }

    #[test]
    fn migrate_is_idempotent_on_a_current_file() {
        // A fresh file already has the column but is stamped user_version 0, so
        // open() runs the migration over it: it must not fail on a duplicate.
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

    fn single(id: &str, status: JobStatus) -> Job {
        Job {
            id: id.into(),
            url: "https://example.com/watch?v=abc".into(),
            kind: JobKind::Single,
            status,
            failed_step: None,
            error: None,
            title: Some("Song".into()),
            artist: Some("Artist".into()),
            thumbnail: None,
            duration: Some(212.5),
            staged_path: None,
            item_id: Some(42),
            report: Some(json!({ "item_id": 42, "completion": 0.8 })),
            tracks: Vec::new(),
            download_attempts: 1,
            category: Some("Video Games".into()),
            forced_album: None,
            unavailable: 0,
            created_at: 1000,
            updated_at: 1000,
        }
    }

    fn track(index: u32, status: TrackStatus) -> AlbumTrack {
        AlbumTrack {
            index,
            video_id: format!("vid{index}"),
            url: format!("https://example.com/watch?v=vid{index}"),
            title: Some(format!("Track {index}")),
            duration: Some(180.0),
            status,
            error: None,
            staged_path: None,
            item_id: Some(index as i64),
            report: Some(json!({ "index": index })),
            duplicate_of: None,
            download_attempts: 2,
        }
    }

    #[test]
    fn round_trips_a_single_job_with_report() {
        let conn = mem();
        let job = single("a", JobStatus::Done);
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "a").unwrap().unwrap();
        assert_eq!(read.status, JobStatus::Done);
        assert_eq!(read.item_id, Some(42));
        assert_eq!(read.duration, Some(212.5));
        assert_eq!(read.report, job.report);
        assert!(read.tracks.is_empty());
    }

    #[test]
    fn round_trips_album_tracks_in_order() {
        let conn = mem();
        let mut job = single("b", JobStatus::Enriching);
        job.kind = JobKind::Album;
        job.failed_step = None;
        job.tracks = vec![
            track(1, TrackStatus::Done),
            track(2, TrackStatus::Imported),
            track(3, TrackStatus::Failed),
        ];
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "b").unwrap().unwrap();
        assert_eq!(read.kind, JobKind::Album);
        let indices: Vec<u32> = read.tracks.iter().map(|t| t.index).collect();
        assert_eq!(indices, vec![1, 2, 3]);
        assert_eq!(read.tracks[1].status, TrackStatus::Imported);
        assert_eq!(read.tracks[2].report, Some(json!({ "index": 3 })));
    }

    #[test]
    fn failed_step_survives_the_round_trip() {
        let conn = mem();
        let mut job = single("c", JobStatus::Failed);
        job.failed_step = Some(JobStep::Enrich);
        job.error = Some("boom".into());
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "c").unwrap().unwrap();
        assert_eq!(read.failed_step, Some(JobStep::Enrich));
        assert_eq!(read.error.as_deref(), Some("boom"));
    }

    #[test]
    fn update_track_touches_one_row_and_bumps_updated_at() {
        let conn = mem();
        let mut job = single("d", JobStatus::Downloading);
        job.kind = JobKind::Album;
        job.tracks = vec![
            track(1, TrackStatus::Pending),
            track(2, TrackStatus::Pending),
        ];
        upsert_job(&conn, &job).unwrap();

        let mut t2 = track(2, TrackStatus::Downloaded);
        t2.staged_path = Some("/tmp/2.m4a".into());
        update_track(&conn, "d", 2000, &t2).unwrap();

        let read = get_job(&conn, "d").unwrap().unwrap();
        assert_eq!(read.updated_at, 2000);
        assert_eq!(read.tracks[0].status, TrackStatus::Pending);
        assert_eq!(read.tracks[1].status, TrackStatus::Downloaded);
        assert_eq!(read.tracks[1].staged_path.as_deref(), Some("/tmp/2.m4a"));
    }

    #[test]
    fn fail_interrupted_only_touches_in_flight() {
        let conn = mem();
        let mut running = single("e", JobStatus::Downloading);
        running.kind = JobKind::Album;
        running.tracks = vec![
            track(1, TrackStatus::Downloading),
            track(2, TrackStatus::Done),
        ];
        upsert_job(&conn, &running).unwrap();
        upsert_job(&conn, &single("f", JobStatus::Done)).unwrap();
        upsert_job(&conn, &single("f2", JobStatus::Cancelled)).unwrap();

        assert!(fail_interrupted(&conn, 3000).unwrap());

        let e = get_job(&conn, "e").unwrap().unwrap();
        assert_eq!(e.status, JobStatus::Failed);
        assert_eq!(e.updated_at, 3000);
        assert_eq!(e.tracks[0].status, TrackStatus::Pending);
        assert_eq!(e.tracks[1].status, TrackStatus::Done);

        let f = get_job(&conn, "f").unwrap().unwrap();
        assert_eq!(f.status, JobStatus::Done);

        // A user's stop is terminal state, not an interruption to repaint.
        let f2 = get_job(&conn, "f2").unwrap().unwrap();
        assert_eq!(f2.status, JobStatus::Cancelled);
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
    fn list_jobs_is_newest_first() {
        let conn = mem();
        let mut older = single("old", JobStatus::Done);
        older.created_at = 100;
        let mut newer = single("new", JobStatus::Done);
        newer.created_at = 200;
        upsert_job(&conn, &older).unwrap();
        upsert_job(&conn, &newer).unwrap();

        let ids: Vec<String> = list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .into_iter()
            .map(|j| j.id)
            .collect();
        assert_eq!(ids, vec!["new".to_string(), "old".to_string()]);
    }

    /// The live window keeps every moving job — a retried failure can be the
    /// oldest row in the store — while only the newest terminal ones ride.
    #[test]
    fn live_window_keeps_old_active_jobs_and_drops_old_terminal_ones() {
        let conn = mem();
        let mut ancient_active = single("ancient-active", JobStatus::Queued);
        ancient_active.created_at = 1;
        upsert_job(&conn, &ancient_active).unwrap();
        for i in 0..4u64 {
            let mut done = single(&format!("done-{i}"), JobStatus::Done);
            done.created_at = 100 + i;
            upsert_job(&conn, &done).unwrap();
        }

        let ids: Vec<String> = list_live_jobs(&conn, 2)
            .unwrap()
            .into_iter()
            .map(|j| j.id)
            .collect();
        // The two newest terminal jobs, then the ancient live one — never lost.
        assert_eq!(
            ids,
            vec![
                "done-3".to_string(),
                "done-2".to_string(),
                "ancient-active".to_string()
            ]
        );
    }

    #[test]
    fn jobs_page_slices_newest_first_and_reports_totals() {
        let conn = mem();
        for i in 0..7u64 {
            let status = if i == 0 {
                JobStatus::Queued
            } else {
                JobStatus::Done
            };
            let mut job = single(&format!("job-{i}"), status);
            job.created_at = 100 + i;
            upsert_job(&conn, &job).unwrap();
        }

        let first = list_jobs_page(&conn, 0, 3).unwrap();
        assert_eq!(first.total, 7);
        assert_eq!(first.terminal_total, 6);
        let ids: Vec<String> = first.jobs.into_iter().map(|j| j.id).collect();
        assert_eq!(
            ids,
            vec![
                "job-6".to_string(),
                "job-5".to_string(),
                "job-4".to_string()
            ]
        );

        let last = list_jobs_page(&conn, 6, 3).unwrap();
        assert_eq!(last.jobs.len(), 1);
        assert_eq!(last.jobs[0].id, "job-0");

        let past_the_end = list_jobs_page(&conn, 30, 3).unwrap();
        assert!(past_the_end.jobs.is_empty());
        assert_eq!(past_the_end.total, 7);
    }

    fn import(id: &str, finished_at: u64) -> ImportRecord {
        ImportRecord {
            id: id.to_string(),
            folder: "/Volumes/Backup/Music".to_string(),
            status: ImportStatus::Done,
            error: None,
            scan: ScanCounts {
                playable: 4287,
                unplayable: 25,
                unplayable_by_extension: [("wma".to_string(), 19u64), ("opus".to_string(), 6)]
                    .into(),
                bytes: 31_400_000_000,
                album_folders: 312,
            },
            folders: 312,
            renditions: 40,
            grouping: Some("tracks".to_string()),
            category: Some("Video Games".to_string()),
            recap: Some(json!({ "tracks": 4312, "withoutGenre": 96 })),
            undone_at: None,
            finished_at,
        }
    }

    /// The recap and the extension map are the two fields that go through JSON
    /// on the way in, which is where an archive silently loses its detail.
    #[test]
    fn an_import_survives_the_round_trip_whole() {
        let conn = mem();
        insert_import(&conn, &import("i", 100)).unwrap();

        let stored = list_imports(&conn).unwrap();

        assert_eq!(stored.len(), 1);
        let record = &stored[0];
        assert_eq!(record.scan.unplayable_by_extension.get("wma"), Some(&19));
        assert_eq!(record.scan.bytes, 31_400_000_000);
        assert_eq!(
            record.recap.as_ref().and_then(|r| r.get("withoutGenre")),
            Some(&json!(96))
        );
        assert!(matches!(record.status, ImportStatus::Done));
    }

    /// The undo keeps the row and stamps it. An archive that deleted the row
    /// would say the import never happened, which is the one thing it knows to
    /// be false.
    #[test]
    fn undoing_an_import_stamps_the_row_instead_of_dropping_it() {
        let conn = mem();
        insert_import(&conn, &import("i", 100)).unwrap();

        mark_import_undone(&conn, "i", 500).unwrap();

        let record = get_import(&conn, "i").unwrap().unwrap();
        assert_eq!(record.undone_at, Some(500));
        assert_eq!(list_imports(&conn).unwrap().len(), 1);
        assert!(get_import(&conn, "nobody").unwrap().is_none());
    }

    #[test]
    fn list_imports_is_newest_first() {
        let conn = mem();
        insert_import(&conn, &import("old", 100)).unwrap();
        insert_import(&conn, &import("new", 200)).unwrap();

        let ids: Vec<String> = list_imports(&conn)
            .unwrap()
            .into_iter()
            .map(|record| record.id)
            .collect();
        assert_eq!(ids, vec!["new".to_string(), "old".to_string()]);
    }

    #[test]
    fn an_artist_image_round_trips_and_replacement_reports_the_orphan() {
        let conn = mem();
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 100).unwrap(),
            None
        );
        // Same file again: nothing to delete.
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 150).unwrap(),
            None
        );
        // New file: the old one goes ownerless.
        assert_eq!(
            upsert_artist_image(&conn, "Hans Zimmer", "b.png", "local", 200).unwrap(),
            Some("a.jpg".to_string())
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Hans Zimmer");
        assert_eq!(rows[0].filename, "b.png");
        assert_eq!(rows[0].updated_at, 200);
    }

    #[test]
    fn removing_an_artist_image_hands_back_its_file() {
        let conn = mem();
        upsert_artist_image(&conn, "Hans Zimmer", "a.jpg", "local", 100).unwrap();

        assert_eq!(
            remove_artist_image(&conn, "Hans Zimmer").unwrap(),
            Some("a.jpg".to_string())
        );
        assert!(list_artist_images(&conn).unwrap().is_empty());
        assert_eq!(remove_artist_image(&conn, "Hans Zimmer").unwrap(), None);
    }

    #[test]
    fn a_rename_moves_the_image_with_the_name() {
        let conn = mem();
        upsert_artist_image(&conn, "Hanz Zimmer", "a.jpg", "local", 100).unwrap();

        assert_eq!(
            rename_artist_image(&conn, "Hanz Zimmer", "Hans Zimmer", "Hans Zimmer.jpg").unwrap(),
            None
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows[0].name, "Hans Zimmer");
        assert_eq!(rows[0].filename, "Hans Zimmer.jpg");
    }

    /// Renaming usually merges a misspelling into an artist that already
    /// exists: the established artist's picture wins, the stray's file is
    /// reported for deletion.
    #[test]
    fn a_rename_onto_an_existing_image_keeps_the_target_and_orphans_the_source() {
        let conn = mem();
        upsert_artist_image(&conn, "Hanz Zimmer", "stray.jpg", "local", 100).unwrap();
        upsert_artist_image(&conn, "Hans Zimmer", "kept.jpg", "local", 100).unwrap();

        assert_eq!(
            rename_artist_image(&conn, "Hanz Zimmer", "Hans Zimmer", "unused.jpg").unwrap(),
            Some("stray.jpg".to_string())
        );

        let rows = list_artist_images(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].filename, "kept.jpg");
    }

    #[test]
    fn a_rename_with_no_image_is_a_no_op() {
        let conn = mem();
        assert_eq!(
            rename_artist_image(&conn, "Nobody", "Somebody", "Somebody.jpg").unwrap(),
            None
        );
        assert!(list_artist_images(&conn).unwrap().is_empty());
    }

    /// The page archives both ways music arrives, and its one button says
    /// "clear the history": the sweep takes the imports with it.
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
