//! Download job queue: one sequential worker drives each job through
//! `download → import → enrich`, persists state, and emits `jobs:updated`.

use std::collections::HashSet;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::jobs_store;
use crate::library_import;
use crate::playlists;
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::settings;
use crate::sidecar::SidecarState;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const IMPORT_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const ENRICH_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const PROBE_TIMEOUT: Duration = Duration::from_secs(3 * 60);
/// Library writes only (DB session + tag writes), no network.
const LIBRARY_TIMEOUT: Duration = Duration::from_secs(60);
/// Covers the whole album: fingerprints, MusicBrainz calls and covers.
const ENRICH_ALBUM_TIMEOUT: Duration = Duration::from_secs(20 * 60);
/// Up to 2x jitter on the configured delay, so requests don't look scripted.
const TRACK_SLEEP_JITTER: f64 = 1.0;
/// The source's 403s are usually transient throttling.
const DOWNLOAD_ATTEMPTS: u32 = 3;
/// Doubles per attempt.
const DOWNLOAD_RETRY_PAUSE_SECS: u64 = 6;
const MAX_ALBUM_TRACKS: u64 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobKind {
    Single,
    Album,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Downloading,
    Importing,
    Enriching,
    Done,
    Failed,
    /// Stopped by the user. Resume markers survive for a retry.
    Cancelled,
}

impl JobStatus {
    /// The job has stopped, however it ended, and written everything it will.
    pub fn is_settled(self) -> bool {
        matches!(self, Self::Done | Self::Failed | Self::Cancelled)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStep {
    Download,
    Import,
    Enrich,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackStatus {
    Pending,
    Downloading,
    Downloaded,
    Imported,
    Done,
    Failed,
    /// Removed, private or blocked at the source: nothing to retry.
    Unavailable,
}

/// One playlist entry. `staged_path`/`item_id` are the per-track resume point.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumTrack {
    /// 1-based.
    pub index: u32,
    pub video_id: String,
    pub url: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub status: TrackStatus,
    pub error: Option<String>,
    pub staged_path: Option<String>,
    pub item_id: Option<i64>,
    pub report: Option<Value>,
    /// Kept item this track duplicated (same recording); enrich removed it.
    #[serde(default)]
    pub duplicate_of: Option<i64>,
    /// Download attempts started; every attempt but the last has failed.
    #[serde(default)]
    pub download_attempts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub url: String,
    pub kind: JobKind,
    pub status: JobStatus,
    pub failed_step: Option<JobStep>,
    pub error: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub staged_path: Option<String>,
    /// Set once imported; a retry resumes at enrich.
    #[serde(default)]
    pub item_id: Option<i64>,
    pub report: Option<Value>,
    /// Empty for singles. Album jobs keep `report` at `None`; the front
    /// aggregates per track.
    #[serde(default)]
    pub tracks: Vec<AlbumTrack>,
    /// Single jobs only; album jobs count per track.
    #[serde(default)]
    pub download_attempts: u32,
    /// Library category (beets' `grouping`), applied after enrich so the user's
    /// choice wins. `None` leaves it untouched.
    #[serde(default)]
    pub category: Option<String>,
    /// Album the user assigned to this playlist; `None` is the normal path.
    #[serde(default)]
    pub forced_album: Option<ForcedAlbum>,
    /// File the playlist as one record. Ignored when `forced_album` is set.
    #[serde(default = "default_single_album")]
    pub single_album: bool,
    /// Unavailable playlist slots, skipped but counted.
    #[serde(default)]
    pub unavailable: u32,
    /// When the job's library output was undone. The row stays in the history.
    #[serde(default)]
    pub undone_at: Option<u64>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Also the default for jobs persisted before the option existed.
fn default_single_album() -> bool {
    true
}

/// The album a download must land on: a new user-named record or an existing
/// one. Tracks are still identified individually.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForcedAlbum {
    pub title: String,
    #[serde(default)]
    pub artist: Option<String>,
    /// An existing album row to land on; `title`/`artist` then only describe it.
    #[serde(default)]
    pub album_id: Option<i64>,
}

struct JobsInner {
    /// History DB (jobs.db). rusqlite is sync, so access goes through `with_conn`.
    conn: Arc<StdMutex<Connection>>,
    tx: mpsc::UnboundedSender<String>,
    /// Pending cancel requests, consumed by the worker at its next checkpoint.
    /// In-memory: startup recovery fails whatever a dead app left running.
    cancels: StdMutex<HashSet<String>>,
}

fn request_cancel(inner: &JobsInner, id: &str) {
    inner
        .cancels
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(id.to_string());
}

fn cancel_requested(inner: &JobsInner, id: &str) -> bool {
    inner
        .cancels
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .contains(id)
}

fn take_cancel(inner: &JobsInner, id: &str) -> bool {
    inner
        .cancels
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(id)
}

pub struct JobsState(Arc<JobsInner>);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Runs a blocking DB operation off the async runtime.
async fn with_conn<T, F>(inner: &JobsInner, f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce(&Connection) -> AppResult<T> + Send + 'static,
{
    let conn = inner.conn.clone();
    tokio::task::spawn_blocking(move || {
        let guard = conn.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&guard)
    })
    .await
    .map_err(|err| AppError::Sidecar(format!("jobs db task panicked: {err}")))?
}

/// Opens the history DB, migrates legacy `jobs.json`, and fails jobs left
/// unfinished. Called once from Tauri setup.
///
/// Doesn't start the worker: the launch migration must run first. Returning
/// the receiver makes forgetting [`JobsState::start`] a compile error.
pub fn init(app: &AppHandle) -> AppResult<(JobsState, JobsWorker)> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("sonarche.db");
    let legacy_json = data_dir.join("jobs.json");

    // Adopt the legacy jobs.db with its WAL/SHM files: the WAL may hold
    // committed pages.
    let legacy_db = data_dir.join("jobs.db");
    if legacy_db.exists() && !db_path.exists() {
        for suffix in ["", "-wal", "-shm"] {
            let from = data_dir.join(format!("jobs.db{suffix}"));
            if from.exists() {
                let _ = std::fs::rename(&from, data_dir.join(format!("sonarche.db{suffix}")));
            }
        }
    }

    let conn = jobs_store::open(&db_path)?;

    if let Err(err) = playlists::ensure_favorites(&conn, now_ms()) {
        eprintln!("[playlists] favorites seed failed: {err}");
    }

    // One-time import; INSERT OR REPLACE keeps it idempotent.
    if legacy_json.exists() {
        match std::fs::read_to_string(&legacy_json)
            .ok()
            .and_then(|raw| serde_json::from_str::<Vec<Job>>(&raw).ok())
        {
            Some(jobs) => match jobs_store::import_jobs(&conn, &jobs) {
                Ok(()) => {
                    let _ = std::fs::rename(&legacy_json, data_dir.join("jobs.json.migrated"));
                    eprintln!("[jobs] migrated {} job(s) from jobs.json", jobs.len());
                }
                Err(err) => eprintln!("[jobs] legacy import failed, keeping jobs.json: {err}"),
            },
            None => eprintln!("[jobs] could not read legacy jobs.json; leaving it in place"),
        }
    }

    if let Ok(true) = jobs_store::fail_interrupted(&conn, now_ms()) {
        eprintln!("[jobs] marked interrupted job(s) as failed");
    }

    let (tx, rx) = mpsc::unbounded_channel();
    let inner = Arc::new(JobsInner {
        conn: Arc::new(StdMutex::new(conn)),
        tx,
        cancels: StdMutex::new(HashSet::new()),
    });
    Ok((JobsState(inner), JobsWorker(rx)))
}

pub struct JobsWorker(mpsc::UnboundedReceiver<String>);

fn spawn_worker(app: AppHandle, inner: Arc<JobsInner>, mut rx: mpsc::UnboundedReceiver<String>) {
    tauri::async_runtime::spawn(async move {
        while let Some(id) = rx.recv().await {
            run_job(&app, &inner, &id).await;
        }
    });
}

async fn snapshot(inner: &JobsInner, id: &str) -> Option<Job> {
    let id = id.to_string();
    match with_conn(inner, move |c| jobs_store::get_job(c, &id)).await {
        Ok(job) => job,
        Err(err) => {
            eprintln!("[jobs] snapshot failed: {err}");
            None
        }
    }
}

/// Mutates one job, persists it with all its tracks, and broadcasts it.
async fn update_job(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    mutate: impl FnOnce(&mut Job),
) -> Option<Job> {
    let mut job = snapshot(inner, id).await?;
    mutate(&mut job);
    job.updated_at = now_ms();
    let to_write = job.clone();
    if let Err(err) = with_conn(inner, move |c| jobs_store::upsert_job(c, &to_write)).await {
        eprintln!("[jobs] persist failed: {err}");
        return None;
    }
    let _ = app.emit("jobs:updated", &job);
    Some(job)
}

/// Mutates one album track, writing only that row (the download loop's hot
/// path). Still broadcasts the full job.
async fn update_track(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    index: u32,
    mutate: impl FnOnce(&mut AlbumTrack),
) -> Option<Job> {
    let mut job = snapshot(inner, id).await?;
    let updated_at = now_ms();
    let updated_track = {
        let track = job.tracks.iter_mut().find(|t| t.index == index)?;
        mutate(track);
        track.clone()
    };
    job.updated_at = updated_at;
    let id = id.to_string();
    if let Err(err) = with_conn(inner, move |c| {
        jobs_store::update_track(c, &id, updated_at, &updated_track)
    })
    .await
    {
        eprintln!("[jobs] track persist failed: {err}");
        return None;
    }
    let _ = app.emit("jobs:updated", &job);
    Some(job)
}

async fn run_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };
    // Cancelled while queued: the command already wrote the terminal state.
    if job.status == JobStatus::Cancelled {
        take_cancel(inner, id);
        return;
    }
    match job.kind {
        JobKind::Album => run_album_job(app, inner, id).await,
        JobKind::Single => run_single_job(app, inner, id).await,
    }
    // Drop a late cancel so it can't hit a later retry.
    take_cancel(inner, id);
}

async fn run_single_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    // Resume after the last completed step.
    let mut item_id = job.item_id;
    if item_id.is_none() {
        let staged = job
            .staged_path
            .as_ref()
            .filter(|p| std::path::Path::new(p).exists())
            .cloned();
        let path = match staged {
            Some(path) => path,
            None => match run_download(app, inner, id, &job.url).await {
                Ok(path) => path,
                Err(err) => {
                    fail(app, inner, id, JobStep::Download, err).await;
                    return;
                }
            },
        };
        if settle_cancel(app, inner, id).await {
            return;
        }

        job_log(id, "━━ import phase ━━");
        update_job(app, inner, id, |j| j.status = JobStatus::Importing).await;
        match run_import(app, &path, false).await {
            Ok(result) => {
                item_id = result.pointer("/report/item_id").and_then(Value::as_i64);
                update_job(app, inner, id, |j| {
                    j.report = result.get("report").cloned().filter(|r| !r.is_null());
                    j.item_id = item_id;
                })
                .await;
            }
            Err(err) => {
                fail(app, inner, id, JobStep::Import, err).await;
                return;
            }
        }
    }

    // No item id (duplicate skipped): nothing to enrich.
    let Some(item_id) = item_id else {
        update_job(app, inner, id, |j| j.status = JobStatus::Done).await;
        return;
    };
    if settle_cancel(app, inner, id).await {
        return;
    }

    job_log(id, "━━ metadata phase ━━");
    update_job(app, inner, id, |j| j.status = JobStatus::Enriching).await;
    match run_enrich(app, inner, id, item_id).await {
        Ok(result) => {
            if let Some(category) = job.category.as_deref() {
                apply_category(app, id, category, &[item_id]).await;
            }
            if let Some(forced) = job.forced_album.as_ref() {
                // Re-read: probe and enrich may have filled the artist since.
                let artist = snapshot(inner, id).await.and_then(|j| j.artist);
                apply_destination(app, id, forced, &[item_id], artist.as_deref()).await;
            }
            job_log(id, "job done");
            update_job(app, inner, id, |j| {
                j.status = JobStatus::Done;
                if let Some(report) = result.get("report").cloned().filter(|r| !r.is_null()) {
                    j.report = Some(report);
                }
            })
            .await;
        }
        Err(err) => fail(app, inner, id, JobStep::Enrich, err).await,
    }
}

/// Writes a requested cancellation, keeping resume markers; a track caught
/// mid-download goes back to pending. Returns whether the caller must stop.
async fn settle_cancel(app: &AppHandle, inner: &JobsInner, id: &str) -> bool {
    if !take_cancel(inner, id) {
        return false;
    }
    job_log(id, "job cancelled by user");
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Cancelled;
        j.failed_step = None;
        j.error = None;
        for track in &mut j.tracks {
            if track.status == TrackStatus::Downloading {
                track.status = TrackStatus::Pending;
            }
        }
    })
    .await;
    true
}

async fn fail(app: &AppHandle, inner: &JobsInner, id: &str, step: JobStep, err: AppError) {
    // Killing the work process surfaces as a sidecar error; record a cancel.
    if settle_cancel(app, inner, id).await {
        return;
    }
    job_log(id, &format!("job FAILED at {step:?}: {err}"));
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Failed;
        j.failed_step = Some(step);
        j.error = Some(err.to_string());
    })
    .await;
}

/// One trace line per pipeline step, prefixed with the job's short id.
fn job_log(id: &str, msg: &str) {
    eprintln!("[job {}] {msg}", &id[..id.len().min(8)]);
}

/// Set by `sidecar/download.py` on videos the source will never serve.
const UNAVAILABLE_PREFIX: &str = "video-unavailable:";

fn is_unavailable(message: &str) -> bool {
    message.contains(UNAVAILABLE_PREFIX)
}

async fn download_request(app: &AppHandle, url: &str) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    // Without ffmpeg, yt-dlp leaves a fragmented DASH m4a.
    python_env::ensure_ffmpeg(&paths).await?;
    // Optional: without it yt-dlp uses the one client needing no JavaScript.
    let deno = python_env::deno(&paths).await;
    // Read per track: the setting applies when a file is written.
    let format = preferences::load(app).await?.audio_format;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "download",
            json!({
                "url": url,
                "staging_dir": paths.staging_dir.to_string_lossy(),
                "ffmpeg": paths.ffmpeg().to_string_lossy(),
                "deno": deno.as_ref().map(|path| path.to_string_lossy()),
                "audio_format": format,
            }),
            DOWNLOAD_TIMEOUT,
        )
        .await
}

/// Which row carries a download's attempt counter.
#[derive(Clone, Copy)]
enum AttemptTarget {
    Job,
    Track(u32),
}

/// Publishes the attempt number before the retry pause, so the row shows it.
async fn record_attempt(
    app: &AppHandle,
    inner: &JobsInner,
    job_id: &str,
    target: AttemptTarget,
    attempt: u32,
) {
    match target {
        AttemptTarget::Job => {
            update_job(app, inner, job_id, |j| j.download_attempts = attempt).await;
        }
        AttemptTarget::Track(index) => {
            update_track(app, inner, job_id, index, |t| t.download_attempts = attempt).await;
        }
    };
}

/// Downloads one URL with up to DOWNLOAD_ATTEMPTS tries and growing pauses.
async fn download_with_retry(
    app: &AppHandle,
    inner: &JobsInner,
    job_id: &str,
    url: &str,
    target: AttemptTarget,
) -> AppResult<Value> {
    let mut pause = DOWNLOAD_RETRY_PAUSE_SECS;
    let mut attempt = 1;
    loop {
        job_log(
            job_id,
            &format!("attempt {attempt}/{DOWNLOAD_ATTEMPTS}: {url}"),
        );
        record_attempt(app, inner, job_id, target, attempt).await;
        match download_request(app, url).await {
            Ok(result) => {
                job_log(job_id, "downloaded ok");
                return Ok(result);
            }
            // An unavailable video won't come back on retry.
            Err(err) if is_unavailable(&err.to_string()) => {
                job_log(job_id, &format!("unavailable, not retrying: {err}"));
                return Err(err);
            }
            // Killed by a stop request; the caller's checkpoint settles the job.
            Err(err) if cancel_requested(inner, job_id) => {
                return Err(err);
            }
            Err(err) if attempt < DOWNLOAD_ATTEMPTS => {
                job_log(job_id, &format!("failed: {err}"));
                job_log(job_id, &format!("retrying in {pause}s"));
                tokio::time::sleep(Duration::from_secs(pause)).await;
                pause *= 2;
                attempt += 1;
            }
            Err(err) => {
                job_log(
                    job_id,
                    &format!("giving up after {DOWNLOAD_ATTEMPTS} attempts: {err}"),
                );
                return Err(err);
            }
        }
    }
}

async fn run_download(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    url: &str,
) -> AppResult<String> {
    job_log(id, "━━ download phase ━━");
    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;
    let result = download_with_retry(app, inner, id, url, AttemptTarget::Job).await?;

    let path = result
        .get("path")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Sidecar("download returned no file path".into()))?
        .to_string();
    let as_string = |key: &str| result.get(key).and_then(Value::as_str).map(str::to_string);
    update_job(app, inner, id, |j| {
        j.staged_path = Some(path.clone());
        j.title = as_string("title");
        j.artist = as_string("artist");
        j.thumbnail = as_string("thumbnail");
        j.duration = result.get("duration").and_then(Value::as_f64);
    })
    .await;
    Ok(path)
}

async fn run_enrich(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    item_id: i64,
) -> AppResult<Value> {
    let (title, artist) = snapshot(inner, id)
        .await
        .map(|j| (j.title, j.artist))
        .unwrap_or((None, None));
    enrich_item(app, item_id, title, artist).await
}

/// Runs the enrich stage for a beets item. `title`/`artist` only feed the
/// text fallback; `None` reuses the item's own tags. Shared by the worker and
/// the re-enrich command.
pub async fn enrich_item(
    app: &AppHandle,
    item_id: i64,
    title: Option<String>,
    artist: Option<String>,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    python_env::ensure_fpcalc(&paths).await?;

    // The key goes from the keychain to the sidecar, never through the webview.
    let acoustid_key = match settings::read("acoustid").await {
        Ok(key) => key,
        Err(err) => {
            eprintln!("[jobs] keychain read failed, enriching without AcoustID: {err}");
            None
        }
    };

    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "enrich",
            json!({
                "item_id": item_id,
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "title": title,
                "artist": artist,
            }),
            ENRICH_TIMEOUT,
        )
        .await
}

/// Writes the job's category on its items via `library_update`.
///
/// Runs after enrich, which rewrites tags. Never fatal: the category can be
/// set by hand.
async fn apply_category(app: &AppHandle, id: &str, category: &str, item_ids: &[i64]) {
    if item_ids.is_empty() {
        return;
    }
    let paths = match AppPaths::resolve(app) {
        Ok(paths) => paths,
        Err(err) => {
            job_log(id, &format!("category not applied: {err}"));
            return;
        }
    };
    let updates: Vec<Value> = item_ids
        .iter()
        .map(|item_id| json!({ "id": item_id, "fields": { "grouping": category } }))
        .collect();
    let sidecar = app.state::<SidecarState>();
    let result = sidecar
        .request(
            app,
            "library_update",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "updates": updates,
            }),
            LIBRARY_TIMEOUT,
        )
        .await;
    match result {
        Ok(_) => job_log(
            id,
            &format!(
                "category '{category}' applied to {} item(s)",
                item_ids.len()
            ),
        ),
        Err(err) => job_log(id, &format!("category '{category}' not applied: {err}")),
    }
}

/// Moves the job's items onto the user-picked album, last so it wins over
/// the pipeline's filing. Never fatal: the move can be redone by hand.
async fn apply_destination(
    app: &AppHandle,
    id: &str,
    forced: &ForcedAlbum,
    item_ids: &[i64],
    fallback_artist: Option<&str>,
) {
    if item_ids.is_empty() {
        return;
    }
    match move_to_destination(app, forced, item_ids, fallback_artist).await {
        Ok(_) => job_log(
            id,
            &format!(
                "destination « {} » holds {} arriving item(s)",
                forced.title,
                item_ids.len()
            ),
        ),
        Err(err) => job_log(id, &format!("destination not applied: {err}")),
    }
}

/// Move request shared by `apply_destination` and the later
/// "change destination" command.
pub(crate) async fn move_to_destination(
    app: &AppHandle,
    forced: &ForcedAlbum,
    item_ids: &[i64],
    fallback_artist: Option<&str>,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let (target_album_id, new_album) = match forced.album_id {
        Some(album_id) => (Some(album_id), Value::Null),
        None => {
            // The compilation default only applies to a new record without a named artist
            // and more than one track.
            let artist = forced
                .artist
                .clone()
                .or_else(|| fallback_artist.map(str::to_string))
                .unwrap_or_else(|| "Various Artists".to_string());
            (
                None,
                json!({ "album": forced.title, "albumartist": artist }),
            )
        }
    };
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "library_move_tracks",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "item_ids": item_ids,
                "target_album_id": target_album_id,
                "new_album": new_album,
                "kind": Value::Null,
                "renumber": true,
            }),
            LIBRARY_TIMEOUT,
        )
        .await
}

/// The beets items a job filed (album tracks minus dropped duplicates).
pub fn library_item_ids(job: &Job) -> Vec<i64> {
    match job.kind {
        JobKind::Album => job
            .tracks
            .iter()
            .filter(|track| track.duplicate_of.is_none())
            .filter_map(|track| track.item_id)
            .collect(),
        JobKind::Single => job.item_id.into_iter().collect(),
    }
}

async fn run_import(app: &AppHandle, path: &str, singleton: bool) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "import",
            json!({
                "path": path,
                "beets_config": paths.beets_config.to_string_lossy(),
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "singleton": singleton,
            }),
            IMPORT_TIMEOUT,
        )
        .await
}

fn parse_probe_entries(probe: &Value) -> Vec<AlbumTrack> {
    let Some(entries) = probe.get("entries").and_then(Value::as_array) else {
        return Vec::new();
    };
    entries
        .iter()
        .enumerate()
        .filter_map(|(i, entry)| {
            let url = entry.get("url").and_then(Value::as_str)?.to_string();
            Some(AlbumTrack {
                index: (i + 1) as u32,
                video_id: entry
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                url,
                title: entry
                    .get("title")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                duration: entry.get("duration").and_then(Value::as_f64),
                status: TrackStatus::Pending,
                error: None,
                staged_path: None,
                item_id: None,
                report: None,
                duplicate_of: None,
                download_attempts: 0,
            })
        })
        .collect()
}

/// Album pipeline: probe the playlist, then download and import each track
/// through the same sidecar calls as a single job (per-track timeouts and
/// resume). Enrich is one album-wide request so a single release is matched.
async fn run_album_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;

    // Skipped on retry: the entries are persisted.
    if job.tracks.is_empty() {
        job_log(id, "━━ probe phase (playlist listing) ━━");
        let probe = match run_probe(app, &job.url).await {
            Ok(probe) => probe,
            Err(err) => {
                fail(app, inner, id, JobStep::Download, err).await;
                return;
            }
        };
        let is_playlist = probe
            .get("is_playlist")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !is_playlist {
            // Empty playlist or plain video: fall back to the single pipeline.
            update_job(app, inner, id, |j| j.kind = JobKind::Single).await;
            run_single_job(app, inner, id).await;
            return;
        }
        let tracks = parse_probe_entries(&probe);
        if tracks.is_empty() {
            let err = AppError::Sidecar("probe returned no playable entries".into());
            fail(app, inner, id, JobStep::Download, err).await;
            return;
        }
        let as_string = |key: &str| probe.get(key).and_then(Value::as_str).map(str::to_string);
        update_job(app, inner, id, |j| {
            j.title = as_string("title");
            j.artist = as_string("artist");
            j.tracks = tracks;
        })
        .await;
    }

    job_log(id, "━━ download phase ━━");
    let tracks = snapshot(inner, id)
        .await
        .map(|j| j.tracks)
        .unwrap_or_default();
    let total = tracks.len();
    let track_delay = preferences::load(app)
        .await
        .unwrap_or_default()
        .download_delay_seconds;
    let mut downloaded_before = false;
    for track in &tracks {
        if settle_cancel(app, inner, id).await {
            return;
        }
        if track.status == TrackStatus::Done {
            continue;
        }
        if track.item_id.is_some() {
            // Imported by a previous attempt.
            update_track(app, inner, id, track.index, |t| {
                t.status = TrackStatus::Imported;
            })
            .await;
            continue;
        }
        if let Some(path) = track
            .staged_path
            .as_ref()
            .filter(|p| std::path::Path::new(p).exists())
        {
            let _ = path;
            update_track(app, inner, id, track.index, |t| {
                t.status = TrackStatus::Downloaded;
            })
            .await;
            continue;
        }

        if downloaded_before && track_delay > 0.0 {
            let pause = track_delay * (1.0 + fastrand::f64() * TRACK_SLEEP_JITTER);
            tokio::time::sleep(Duration::from_secs_f64(pause)).await;
        }
        downloaded_before = true;

        update_track(app, inner, id, track.index, |t| {
            t.status = TrackStatus::Downloading;
        })
        .await;
        job_log(id, &format!("track {}/{total}", track.index));
        match download_with_retry(
            app,
            inner,
            id,
            &track.url,
            AttemptTarget::Track(track.index),
        )
        .await
        {
            Ok(result) => {
                let as_string =
                    |key: &str| result.get(key).and_then(Value::as_str).map(str::to_string);
                update_track(app, inner, id, track.index, |t| {
                    t.staged_path = as_string("path");
                    if let Some(title) = as_string("title") {
                        t.title = Some(title);
                    }
                    t.duration = result
                        .get("duration")
                        .and_then(Value::as_f64)
                        .or(t.duration);
                    t.status = TrackStatus::Downloaded;
                })
                .await;
                // The first video's thumbnail is the fallback cover for a forced album.
                if let Some(thumbnail) = as_string("thumbnail") {
                    update_job(app, inner, id, |j| {
                        j.thumbnail.get_or_insert(thumbnail);
                    })
                    .await;
                }
            }
            // Interrupted by a stop: back to pending for a future retry.
            Err(_) if cancel_requested(inner, id) => {
                update_track(app, inner, id, track.index, |t| {
                    t.status = TrackStatus::Pending;
                    t.error = None;
                })
                .await;
            }
            Err(err) => {
                // One dead video must not sink the album.
                let message = err.to_string();
                let gone = is_unavailable(&message);
                job_log(
                    id,
                    &format!(
                        "track {} marked {}",
                        track.index,
                        if gone { "unavailable" } else { "failed" }
                    ),
                );
                update_track(app, inner, id, track.index, |t| {
                    t.status = if gone {
                        TrackStatus::Unavailable
                    } else {
                        TrackStatus::Failed
                    };
                    t.error = Some(message);
                })
                .await;
            }
        }
    }

    if settle_cancel(app, inner, id).await {
        return;
    }

    // Singletons; enrich_album creates the album row.
    job_log(id, "━━ import phase ━━");
    update_job(app, inner, id, |j| j.status = JobStatus::Importing).await;
    let tracks = snapshot(inner, id)
        .await
        .map(|j| j.tracks)
        .unwrap_or_default();
    for track in &tracks {
        if track.status != TrackStatus::Downloaded {
            continue;
        }
        let Some(path) = track.staged_path.clone() else {
            continue;
        };
        job_log(id, &format!("importing track {}", track.index));
        match run_import(app, &path, true).await {
            Ok(result) => {
                let item_id = result.pointer("/report/item_id").and_then(Value::as_i64);
                let report = result.get("report").cloned().filter(|r| !r.is_null());
                update_track(app, inner, id, track.index, |t| {
                    t.item_id = item_id;
                    t.report = report;
                    // No item id: duplicate skipped by beets.
                    t.status = if item_id.is_some() {
                        TrackStatus::Imported
                    } else {
                        TrackStatus::Done
                    };
                })
                .await;
            }
            // Interrupted by a stop; the staged file is intact.
            Err(_) if cancel_requested(inner, id) => {
                if settle_cancel(app, inner, id).await {
                    return;
                }
            }
            Err(err) => {
                let message = err.to_string();
                update_track(app, inner, id, track.index, |t| {
                    t.status = TrackStatus::Failed;
                    t.error = Some(message);
                })
                .await;
            }
        }
    }

    if settle_cancel(app, inner, id).await {
        return;
    }

    let Some(job) = snapshot(inner, id).await else {
        return;
    };
    let item_ids: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Imported)
        .filter_map(|t| t.item_id)
        .collect();
    if !item_ids.is_empty() {
        job_log(
            id,
            &format!("━━ metadata phase ({} item(s)) ━━", item_ids.len()),
        );
        update_job(app, inner, id, |j| j.status = JobStatus::Enriching).await;
        match run_enrich_album(app, &job, &item_ids).await {
            Ok(result) => {
                let reports = result
                    .get("reports")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                update_job(app, inner, id, |j| {
                    for entry in &reports {
                        let Some(item_id) = entry.get("item_id").and_then(Value::as_i64) else {
                            continue;
                        };
                        if let Some(track) =
                            j.tracks.iter_mut().find(|t| t.item_id == Some(item_id))
                        {
                            track.report = entry.get("report").cloned().filter(|r| !r.is_null());
                            track.duplicate_of = entry.get("duplicate_of").and_then(Value::as_i64);
                        }
                    }
                    for track in &mut j.tracks {
                        if track.status == TrackStatus::Imported {
                            track.status = TrackStatus::Done;
                        }
                    }
                })
                .await;
            }
            Err(err) => {
                // Tracks stay `Imported`, so a retry resumes at enrich.
                fail(app, inner, id, JobStep::Enrich, err).await;
                return;
            }
        }
    }

    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    let kept: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.duplicate_of.is_none())
        .filter_map(|t| t.item_id)
        .collect();
    if let Some(category) = job.category.as_deref() {
        apply_category(app, id, category, &kept).await;
    }
    // Only an existing target: a new forced album was created by enrich.
    if let Some(forced) = job
        .forced_album
        .as_ref()
        .filter(|forced| forced.album_id.is_some())
    {
        apply_destination(app, id, forced, &kept, job.artist.as_deref()).await;
    }

    let total = job.tracks.len();
    let failed = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Failed)
        .count();
    // Counted apart from `failed`: nothing to retry.
    let unavailable = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Unavailable)
        .count() as u32;
    if unavailable > 0 {
        job_log(
            id,
            &format!("{unavailable} of {total} track(s) no longer available at the source"),
        );
    }
    update_job(app, inner, id, |j| j.unavailable = unavailable).await;

    // `Failed` only when nothing could be produced. Some dead videos still make
    // the job `Done`, with the tally in `error`.
    if unavailable as usize == total {
        job_log(id, &format!("job FAILED: all {total} video(s) unavailable"));
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Failed;
            j.failed_step = Some(JobStep::Download);
            j.error = Some(format!("all {total} videos are no longer available"));
        })
        .await;
        return;
    }
    if failed == 0 {
        job_log(id, "job done");
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Done;
            j.error = None;
        })
        .await;
        return;
    }
    if failed == total {
        job_log(id, &format!("job FAILED: all {total} track(s) failed"));
        // The earliest failing phase.
        let step = if job
            .tracks
            .iter()
            .any(|t| t.status == TrackStatus::Failed && t.staged_path.is_none())
        {
            JobStep::Download
        } else {
            JobStep::Import
        };
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Failed;
            j.failed_step = Some(step);
            j.error = Some(format!("{failed} of {total} tracks failed"));
        })
        .await;
        return;
    }
    job_log(
        id,
        &format!("job done with {failed}/{total} failed track(s)"),
    );
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Done;
        j.failed_step = None;
        j.error = Some(format!("{failed} of {total} tracks failed"));
    })
    .await;
}

async fn run_probe(app: &AppHandle, url: &str) -> AppResult<Value> {
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "probe",
            json!({ "url": url, "max_entries": MAX_ALBUM_TRACKS }),
            PROBE_TIMEOUT,
        )
        .await
}

async fn run_enrich_album(app: &AppHandle, job: &Job, item_ids: &[i64]) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    python_env::ensure_fpcalc(&paths).await?;

    // The key goes from the keychain to the sidecar, never through the webview.
    let acoustid_key = match settings::read("acoustid").await {
        Ok(key) => key,
        Err(err) => {
            eprintln!("[jobs] keychain read failed, enriching without AcoustID: {err}");
            None
        }
    };
    let prefs = preferences::load(app).await?;

    let track_hints: Vec<Value> = job
        .tracks
        .iter()
        .filter(|t| t.item_id.is_some())
        .map(|t| {
            json!({
                "item_id": t.item_id,
                "index": t.index,
                "title": t.title,
                "duration": t.duration,
            })
        })
        .collect();

    // An existing target is handled afterwards by `apply_destination`.
    let forced_album = job
        .forced_album
        .as_ref()
        .filter(|forced| forced.album_id.is_none())
        .map(|forced| {
            json!({
                "title": forced.title,
                "artist": forced.artist,
                "category": job.category,
                "thumbnail": job.thumbnail,
            })
        });

    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "enrich_album",
            json!({
                "item_ids": item_ids,
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "album_title": job.title,
                "artist": job.artist,
                "forced_album": forced_album,
                "single_album": job.single_album,
                "category": job.category,
                "thumbnail": job.thumbnail,
                "track_hints": track_hints,
                "fetch_pause_seconds": prefs.lastfm_fetch_delay_seconds,
                "lookup_pause_seconds": prefs.acoustid_lookup_delay_seconds,
            }),
            ENRICH_ALBUM_TIMEOUT,
        )
        .await
}

impl JobsState {
    /// Starts the worker, after the launch migration (see [`init`]).
    pub fn start(&self, app: AppHandle, worker: JobsWorker) {
        spawn_worker(app, self.0.clone(), worker.0);
    }

    /// Setup hook only: no worker yet, and blocking is acceptable there.
    pub fn with_conn_blocking<T>(
        &self,
        f: impl FnOnce(&Connection) -> AppResult<T>,
    ) -> AppResult<T> {
        let guard = self
            .0
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&guard)
    }

    pub async fn enqueue(
        &self,
        app: &AppHandle,
        url: String,
        kind: JobKind,
        category: Option<String>,
        forced_album: Option<ForcedAlbum>,
        single_album: bool,
    ) -> AppResult<Job> {
        let now = now_ms();
        let job = Job {
            id: Uuid::new_v4().to_string(),
            url,
            kind,
            status: JobStatus::Queued,
            failed_step: None,
            error: None,
            title: None,
            artist: None,
            thumbnail: None,
            duration: None,
            staged_path: None,
            item_id: None,
            report: None,
            tracks: Vec::new(),
            download_attempts: 0,
            category,
            forced_album,
            single_album,
            unavailable: 0,
            undone_at: None,
            created_at: now,
            updated_at: now,
        };

        let to_write = job.clone();
        with_conn(&self.0, move |c| jobs_store::upsert_job(c, &to_write)).await?;

        let _ = app.emit("jobs:updated", &job);
        self.0
            .tx
            .send(job.id.clone())
            .map_err(|_| AppError::Sidecar("job worker is not running".into()))?;
        Ok(job)
    }

    /// Stops a job: a queued one is settled immediately; a running one has its
    /// sidecar request killed and is settled at the next checkpoint.
    pub async fn cancel(
        &self,
        app: &AppHandle,
        sidecar: &SidecarState,
        id: &str,
    ) -> AppResult<Job> {
        let current = snapshot(&self.0, id)
            .await
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
        if matches!(
            current.status,
            JobStatus::Done | JobStatus::Failed | JobStatus::Cancelled
        ) {
            return Err(AppError::InvalidInput("job already finished".into()));
        }
        request_cancel(&self.0, id);
        if current.status == JobStatus::Queued {
            // The flag stays armed: if the worker picked the job up meanwhile, its
            // checkpoint wins; otherwise `run_job` consumes it.
            update_job(app, &self.0, id, |j| j.status = JobStatus::Cancelled).await;
        } else {
            // The queue is serial, so the work channel is running this job. The channel
            // restarts on the next request.
            sidecar.abort_work().await;
        }
        snapshot(&self.0, id)
            .await
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))
    }

    pub async fn retry(&self, app: &AppHandle, id: &str) -> AppResult<Job> {
        let current = snapshot(&self.0, id)
            .await
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
        // A stale cancel must not stop the retried run.
        take_cancel(&self.0, id);
        // A partly-failed album is `Done` but still has tracks to retry.
        let has_failed_tracks = current
            .tracks
            .iter()
            .any(|t| t.status == TrackStatus::Failed);
        if !matches!(current.status, JobStatus::Failed | JobStatus::Cancelled) && !has_failed_tracks
        {
            return Err(AppError::InvalidInput("job has nothing to retry".into()));
        }
        let job = update_job(app, &self.0, id, |j| {
            j.status = JobStatus::Queued;
            j.failed_step = None;
            j.error = None;
            // Resume markers survive so each track restarts where it stopped.
            for track in &mut j.tracks {
                if track.status == TrackStatus::Failed {
                    track.status = TrackStatus::Pending;
                    track.error = None;
                }
            }
        })
        .await
        .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
        self.0
            .tx
            .send(job.id.clone())
            .map_err(|_| AppError::Sidecar("job worker is not running".into()))?;
        Ok(job)
    }

    pub async fn get(&self, id: &str) -> AppResult<Option<Job>> {
        let owned = id.to_string();
        with_conn(&self.0, move |c| jobs_store::get_job(c, &owned)).await
    }

    pub async fn mark_undone(&self, app: &AppHandle, id: &str, when: u64) -> AppResult<Job> {
        let owned = id.to_string();
        with_conn(&self.0, move |c| {
            jobs_store::mark_job_undone(c, &owned, when)
        })
        .await?;
        let job = self
            .get(id)
            .await?
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
        let _ = app.emit("jobs:updated", &job);
        Ok(job)
    }

    /// Re-files a settled job's items onto another album.
    pub async fn change_destination(
        &self,
        app: &AppHandle,
        id: &str,
        forced: ForcedAlbum,
    ) -> AppResult<Job> {
        let job = self
            .get(id)
            .await?
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
        if !job.status.is_settled() {
            return Err(AppError::InvalidInput("job is still running".into()));
        }
        if job.undone_at.is_some() {
            return Err(AppError::InvalidInput("this download was undone".into()));
        }
        let item_ids = library_item_ids(&job);
        if item_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "this download filed nothing in the library".into(),
            ));
        }
        move_to_destination(app, &forced, &item_ids, job.artist.as_deref()).await?;
        update_job(app, &self.0, id, move |j| j.forced_album = Some(forced))
            .await
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))
    }

    /// Every running job plus the most recent finished ones. The full archive is
    /// paged through `page`.
    pub async fn list(&self) -> Vec<Job> {
        match with_conn(&self.0, |conn| {
            jobs_store::list_live_jobs(conn, jobs_store::LIVE_TERMINAL_WINDOW)
        })
        .await
        {
            Ok(jobs) => jobs,
            Err(err) => {
                eprintln!("[jobs] list failed: {err}");
                Vec::new()
            }
        }
    }

    /// Album rows that in-flight jobs will file into, so they can't be deleted
    /// from under them.
    pub async fn target_albums(&self) -> Vec<i64> {
        self.list()
            .await
            .iter()
            .filter(|job| !job.status.is_settled())
            .filter_map(|job| job.forced_album.as_ref()?.album_id)
            .collect()
    }

    /// One page of the archive, newest first. Unlike `list`, errors surface.
    pub async fn page(&self, offset: u64, limit: u64) -> AppResult<jobs_store::JobsPage> {
        with_conn(&self.0, move |conn| {
            jobs_store::list_jobs_page(conn, offset, limit)
        })
        .await
    }

    /// Archives a finished library import. Errors are only logged: the import
    /// itself succeeded.
    pub async fn record_import(&self, record: library_import::ImportRecord) {
        if let Err(err) = with_conn(&self.0, move |conn| {
            jobs_store::insert_import(conn, &record)
        })
        .await
        {
            eprintln!("[imports] recording failed: {err}");
        }
    }

    /// One archived import; unlike `list_imports`, errors are returned.
    pub async fn get_import(&self, id: &str) -> AppResult<Option<library_import::ImportRecord>> {
        let id = id.to_string();
        with_conn(&self.0, move |conn| jobs_store::get_import(conn, &id)).await
    }

    /// Errors are only logged: the tracks are already removed.
    pub async fn mark_import_undone(&self, id: &str, when: u64) {
        let owned = id.to_string();
        if let Err(err) = with_conn(&self.0, move |conn| {
            jobs_store::mark_import_undone(conn, &owned, when)
        })
        .await
        {
            eprintln!("[imports] marking {id} undone failed: {err}");
        }
    }

    pub async fn count_playlist_memberships(
        &self,
        item_ids: std::collections::HashSet<i64>,
    ) -> AppResult<usize> {
        with_conn(&self.0, move |conn| {
            playlists::count_memberships(conn, &item_ids)
        })
        .await
    }

    /// Drops every playlist membership pointing at these items.
    pub async fn prune_playlists(
        &self,
        item_ids: std::collections::HashSet<i64>,
    ) -> AppResult<usize> {
        let now = now_ms();
        with_conn(&self.0, move |conn| {
            playlists::remove_items_everywhere(conn, &item_ids, now)
        })
        .await
    }

    pub async fn list_imports(&self) -> Vec<library_import::ImportRecord> {
        match with_conn(&self.0, jobs_store::list_imports).await {
            Ok(records) => records,
            Err(err) => {
                eprintln!("[imports] list failed: {err}");
                Vec::new()
            }
        }
    }

    /// Drops finished jobs and the import archive; running jobs are kept.
    pub async fn clear_history(&self) -> Vec<Job> {
        if let Err(err) = with_conn(&self.0, jobs_store::clear_history).await {
            eprintln!("[jobs] clear history failed: {err}");
        }
        self.list().await
    }

    // Artist images and playlists share this store; timestamps are set here so
    // the store functions stay pure.

    pub async fn list_artist_images(&self) -> AppResult<Vec<jobs_store::ArtistImageRow>> {
        with_conn(&self.0, jobs_store::list_artist_images).await
    }

    /// Returns the replaced file's name, if any.
    pub async fn set_artist_image(
        &self,
        name: String,
        filename: String,
        source: String,
    ) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            jobs_store::upsert_artist_image(c, &name, &filename, &source, now)
        })
        .await
    }

    /// Returns the removed row's filename, if any.
    pub async fn remove_artist_image(&self, name: String) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| jobs_store::remove_artist_image(c, &name)).await
    }

    /// Returns the filename left unowned by the rename, if any. `filename` is the
    /// new name; the caller renames the file first.
    pub async fn rename_artist_image(
        &self,
        old: String,
        new: String,
        filename: String,
    ) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| {
            jobs_store::rename_artist_image(c, &old, &new, &filename)
        })
        .await
    }

    pub async fn clear_artist_images(&self) -> AppResult<()> {
        with_conn(&self.0, jobs_store::clear_artist_images).await
    }

    pub async fn list_playlists(&self) -> AppResult<Vec<playlists::PlaylistRow>> {
        with_conn(&self.0, playlists::list).await
    }

    pub async fn create_playlist(&self, name: String) -> AppResult<playlists::PlaylistRow> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::create(c, &name, now)).await
    }

    pub async fn rename_playlist(&self, id: i64, name: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::rename(c, id, &name, now)).await
    }

    /// Returns the cover filename left unowned, if any.
    pub async fn delete_playlist(&self, id: i64) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| playlists::delete(c, id)).await
    }

    /// Returns the replaced file's name, if any.
    pub async fn set_playlist_cover(&self, id: i64, filename: String) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::set_cover(c, id, &filename, now)
        })
        .await
    }

    pub async fn update_playlist_cover_filename(&self, id: i64, filename: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::update_cover_filename(c, id, &filename, now)
        })
        .await
    }

    /// Returns the removed file's name, if any.
    pub async fn remove_playlist_cover(&self, id: i64) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::remove_cover(c, id, now)).await
    }

    /// An empty string clears the marker.
    pub async fn set_playlist_marker(&self, id: i64, marker: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::set_marker(c, id, &marker, now)).await
    }

    /// Returns (added, skipped as already present).
    pub async fn add_playlist_tracks(
        &self,
        id: i64,
        item_ids: Vec<i64>,
    ) -> AppResult<(usize, usize)> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::add_tracks(c, id, &item_ids, now)
        })
        .await
    }

    /// Returns how many rows were removed.
    pub async fn remove_playlist_tracks(&self, id: i64, positions: Vec<u32>) -> AppResult<usize> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::remove_positions(c, id, &positions, now)
        })
        .await
    }

    pub async fn move_playlist_track(&self, id: i64, from: u32, to: u32) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::move_track(c, id, from, to, now)
        })
        .await
    }

    /// Best-effort; the caller only logs failures.
    pub async fn remove_item_from_playlists(&self, item_id: i64) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::remove_item_everywhere(c, item_id, now)
        })
        .await
    }

    pub async fn clear_playlists(&self) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::clear(c)?;
            // The built-in list survives an erase, emptied.
            playlists::ensure_favorites(c, now)
        })
        .await
    }

    /// Empties every playlist without deleting any (after a library wipe).
    pub async fn clear_playlist_memberships(&self) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::clear_memberships(c, now)).await
    }
}
