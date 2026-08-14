//! Download job queue: one sequential worker drives each job through
//! `download → import`, persists state to app data, and pushes every
//! transition to the webview as a `jobs:updated` event.

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
/// Plain library writes (the post-enrich category stamp): a DB session and N
/// tag writes, no network.
const LIBRARY_TIMEOUT: Duration = Duration::from_secs(60);
/// One request covers the whole album: N fingerprints + MB calls + covers.
const ENRICH_ALBUM_TIMEOUT: Duration = Duration::from_secs(20 * 60);
/// The configured download delay is a floor, not a metronome: jittering it up
/// to 2x keeps the batch from looking like a scripted, perfectly-timed loop.
const TRACK_SLEEP_JITTER: f64 = 1.0;
/// YouTube 403s are transient flow protection, not permanent failures: retry
/// each URL a few times before giving up on it. A handful of polite, spaced
/// attempts doesn't escalate throttling; hammering without pause does.
const DOWNLOAD_ATTEMPTS: u32 = 3;
/// Pause before the first retry; doubles per attempt (6s, then 12s).
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
    /// Stopped by the user. Terminal like `Failed`, but nothing went wrong:
    /// per-track resume markers survive, so a retry picks up where it stopped.
    Cancelled,
}

impl JobStatus {
    /// The job has stopped moving, however it ended. Whatever it was going to
    /// write to the library, it has written.
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
    /// Staged file on disk, not yet imported.
    Downloaded,
    /// beets item exists, not yet enriched.
    Imported,
    Done,
    Failed,
    /// The source will never serve this one: removed, made private, blocked or
    /// claimed since the playlist was assembled. Distinct from `Failed` because
    /// there is nothing to retry and nothing went wrong on our side — the
    /// playlist simply lists a video that no longer plays.
    Unavailable,
}

/// One entry of an album job's playlist. `staged_path`/`item_id` encode the
/// per-track resume position, mirroring the same fields on a single job.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumTrack {
    /// 1-based playlist position.
    pub index: u32,
    pub video_id: String,
    pub url: String,
    pub title: Option<String>,
    pub duration: Option<f64>,
    pub status: TrackStatus,
    pub error: Option<String>,
    pub staged_path: Option<String>,
    pub item_id: Option<i64>,
    /// Per-track metadata report, verbatim from the sidecar.
    pub report: Option<Value>,
    /// Kept item this track duplicated: the enrich step removed it from the
    /// library (same AcoustID recording, so same audio under another title).
    #[serde(default)]
    pub duplicate_of: Option<i64>,
    /// How many download attempts have been started (0 before the first, up to
    /// DOWNLOAD_ATTEMPTS). Combined with `status` it says which tries failed:
    /// every attempt before the last one did, by construction.
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
    /// beets item id once imported; lets a retry resume at the enrich step.
    #[serde(default)]
    pub item_id: Option<i64>,
    /// Post-import/enrich metadata report, verbatim from the sidecar.
    pub report: Option<Value>,
    /// Playlist entries of an album job; empty for singles (and until probe).
    /// `report` stays None on album jobs — the frontend aggregates per track.
    #[serde(default)]
    pub tracks: Vec<AlbumTrack>,
    /// Download attempts started for a single job; album jobs count per track.
    #[serde(default)]
    pub download_attempts: u32,
    /// The library category (beets' `grouping`) the user picked when queueing —
    /// context, not musical style. Written onto every item the job produced,
    /// after enrich so the user's choice wins over whatever the pipeline set.
    /// `None` means "don't touch it", which is what every pre-existing job does.
    #[serde(default)]
    pub category: Option<String>,
    /// The album the user declared this playlist to *be*, overriding whatever
    /// releases its tracks turn out to belong to. `None` is the normal path.
    #[serde(default)]
    pub forced_album: Option<ForcedAlbum>,
    /// Playlist slots whose video was deleted, made private or claimed:
    /// skipped before download (they can only fail) but counted, because the
    /// record has holes YouTube cannot even name.
    #[serde(default)]
    pub unavailable: u32,
    /// When the job's library output was taken back out (see `download_undo`).
    /// The row stays — the history still says what happened — but the front
    /// reads this instead of asking the library whether the tracks survive.
    #[serde(default)]
    pub undone_at: Option<u64>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// The album the download must land on, because the user said so — a record
/// assembled by hand (a film, a series, a game), or one already on the shelf.
/// Per-track identity is still looked up; only the filing is decided here.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForcedAlbum {
    pub title: String,
    /// Left to the sidecar's compilation default when the user names none.
    #[serde(default)]
    pub artist: Option<String>,
    /// An existing beets album row to land on, instead of standing up a new
    /// one. With an id, `title`/`artist` only describe the target (history
    /// cards, fallbacks) — the move verb does the filing, post-enrich.
    #[serde(default)]
    pub album_id: Option<i64>,
}

struct JobsInner {
    /// Our own history DB (jobs.db), guarded for serialized access. rusqlite is
    /// sync, so every touch runs inside `spawn_blocking` via `with_conn`.
    conn: Arc<StdMutex<Connection>>,
    tx: mpsc::UnboundedSender<String>,
    /// Jobs the user asked to stop. In-memory on purpose: a cancel only makes
    /// sense against a live worker, and startup recovery already fails whatever
    /// a dead app left behind. The worker consumes an entry at its next
    /// checkpoint and writes the terminal `Cancelled` state.
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

/// Run a blocking DB operation off the async runtime. The connection mutex is
/// only ever held on the blocking thread, never across an await.
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

/// Open the history DB, migrate any legacy `jobs.json` and fail whatever the
/// previous run left unfinished. Called once from Tauri setup.
///
/// Deliberately does NOT start the worker: the launch migration runs between
/// this and [`JobsState::start`], and a worker resuming a queued download must
/// only ever see the migrated layout. The receiver comes back to the caller so
/// forgetting to start is a compile error, not a silent dead queue.
pub fn init(app: &AppHandle) -> AppResult<(JobsState, JobsWorker)> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("sonarche.db");
    let legacy_json = data_dir.join("jobs.json");

    // The DB shipped briefly as jobs.db before it became the app-wide store;
    // adopt any such file in place rather than starting empty.
    //
    // All three files, not just the main one. The store runs in WAL mode, so a
    // `-wal` holding committed-but-uncheckpointed pages is part of the database
    // and not a cache: renaming `jobs.db` alone hands SQLite a file whose most
    // recent writes are sitting in a `-wal` it will never look at again, and
    // leaves the orphans behind for good measure.
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

    // The one playlist the app itself owns; idempotent, so every launch may ask.
    if let Err(err) = playlists::ensure_favorites(&conn, now_ms()) {
        eprintln!("[playlists] favorites seed failed: {err}");
    }

    // One-time import of the pre-SQLite history, then retire the JSON file.
    // INSERT OR REPLACE keeps it idempotent if a prior attempt half-finished.
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

/// The queue's receiving end, waiting to be handed to [`JobsState::start`].
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

/// Apply a mutation to one job, persist it (job row + all its tracks) and
/// broadcast the new state. Use this whenever job-level fields or several
/// tracks may change at once.
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

/// Apply a mutation to one track of an album job, writing only that row plus the
/// parent's `updated_at` — the hot path during a download loop, so it never
/// rewrites the whole playlist. Still broadcasts the full job snapshot.
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
    // Cancelled while still in line: the cancel command already wrote the
    // terminal state, this side only consumes the flag it left armed.
    if job.status == JobStatus::Cancelled {
        take_cancel(inner, id);
        return;
    }
    match job.kind {
        JobKind::Album => run_album_job(app, inner, id).await,
        JobKind::Single => run_single_job(app, inner, id).await,
    }
    // A cancel that landed after the last checkpoint changed nothing; drop it
    // so it cannot bleed into a later retry of the same job.
    take_cancel(inner, id);
}

async fn run_single_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    // Retries resume after the last completed step: an item id means the
    // import already succeeded; a staged file means the download did.
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

    // Without an item id (e.g. duplicate skipped) there is nothing to enrich.
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
                // Re-read for the artist fallback: probe and enrich have
                // filled it in since the job was snapshotted.
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

/// Terminal write of a user cancellation, if one was requested: the job stops
/// where it stands, keeping every per-track resume marker; a track caught
/// mid-download goes back to pending — its file never finished. Returns whether
/// the job was settled, in which case the caller must stop driving it.
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
    // Killing the work process to interrupt a step surfaces here as a sidecar
    // error; the user's stop must not be recorded as a failure.
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

/// Workflow trace for the dev terminal: one readable line per pipeline step,
/// prefixed with the job's short id so parallel history stays attributable.
fn job_log(id: &str, msg: &str) {
    eprintln!("[job {}] {msg}", &id[..id.len().min(8)]);
}

/// The marker `sidecar/download.py` puts on a video YouTube will never serve.
/// The wording of yt-dlp's own message stays the sidecar's business; this side
/// only needs to know the verdict.
const UNAVAILABLE_PREFIX: &str = "video-unavailable:";

fn is_unavailable(message: &str) -> bool {
    message.contains(UNAVAILABLE_PREFIX)
}

/// Raw sidecar download of one URL into the staging dir.
async fn download_request(app: &AppHandle, url: &str) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    // Without ffmpeg beside it, yt-dlp leaves YouTube's m4a as a fragmented
    // DASH container — 0:00 durations and broken seeking on every player that
    // reads classic sample tables (Music.app, iOS, CarPlay).
    python_env::ensure_ffmpeg(&paths).await?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "download",
            json!({
                "url": url,
                "staging_dir": paths.staging_dir.to_string_lossy(),
                "ffmpeg": paths.ffmpeg().to_string_lossy(),
            }),
            DOWNLOAD_TIMEOUT,
        )
        .await
}

/// Which row carries the attempt counter for a download: a single's own job row,
/// or one track of an album playlist.
#[derive(Clone, Copy)]
enum AttemptTarget {
    Job,
    Track(u32),
}

/// Publish "we are now on attempt N" so the UI can light its attempt dots while
/// the retry pauses run — those pauses last 6s then 12s, far too long to leave
/// the row looking idle.
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

/// One URL through the retry policy: transient failures (YouTube 403s, network
/// blips) get DOWNLOAD_ATTEMPTS tries with growing pauses; the row keeps its
/// live status and its attempt count, the terminal log carries the full trail.
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
            // A video that no longer exists will not exist on the third try
            // either. Retrying cost two more round-trips and 18s of sleeping
            // per dead entry — on a playlist with four of them, a minute of
            // waiting for an answer the first attempt already gave.
            Err(err) if is_unavailable(&err.to_string()) => {
                job_log(job_id, &format!("unavailable, not retrying: {err}"));
                return Err(err);
            }
            // A stop request killed the request out from under us; retrying
            // would restart the sidecar and download the file the user just
            // refused. The caller's cancel checkpoint settles the job.
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

/// Run the enrich stage for a beets item. `title`/`artist` are only used by the
/// text fallback; pass `None` to let the sidecar reuse the item's own tags (the
/// re-enrich path has no YouTube hints). Shared by the download worker and the
/// standalone re-enrich command.
pub async fn enrich_item(
    app: &AppHandle,
    item_id: i64,
    title: Option<String>,
    artist: Option<String>,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    python_env::ensure_fpcalc(&paths).await?;

    // The key never transits through the webview; keychain → sidecar directly.
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

/// Stamp the job's category onto the items it produced, through the same
/// `library_update` path the metadata editor uses — beets stays the one writer.
///
/// Runs *after* enrich, not before: enrich rewrites tags from the MusicBrainz
/// match, and the category is the user's own axis, so it has to land last.
/// Never fatal — a job that downloaded, imported and identified has done its
/// work; a failed grouping write is a missing tag the user can set by hand, not
/// a reason to paint the whole run red.
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

/// Land the job's items on the album the user picked — an existing row, or one
/// created on the spot — through the same sidecar verb as the library's own
/// "move onto a record". Runs last, after enrich and the category, so the
/// user's filing wins over whatever the pipeline decided. Never fatal, for the
/// same reason as `apply_category`: the music has landed, and a failed refile
/// is a move the user can redo by hand, not a red job.
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

/// The move request `apply_destination` and the after-the-fact "change the
/// destination" command share: same sidecar verb, same artist fallback, same
/// renumbering — only what happens to a failure differs (a log line mid-run,
/// a surfaced error when the user asked directly).
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
            // A single into a new record keeps its own artist unless the user
            // named one; the compilation default only backstops a mixed pile.
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

/// The beets items a job filed, as recorded on its row: an album's tracks
/// minus the duplicates enrich dropped, a single's one item. What the undo
/// removes and the destination change moves.
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

/// The whole album pipeline: probe the playlist, then drive each track through
/// the same sidecar commands as a single job — the sidecar stays serial and
/// responsive between tracks, timeouts stay per-track, and per-track
/// `staged_path`/`item_id` give resume for free. Only the enrich step is one
/// album-wide request (the release must be matched across all items at once).
async fn run_album_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;

    // Probe — skipped on retry, the entry list is already persisted.
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
            // Stale/emptied playlist or a plain video: fall back to the
            // single pipeline instead of failing the job.
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

    // Download loop: one sidecar request per track, jittered pauses between
    // network hits so the batch never hammers YouTube.
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
            // Imported in a previous attempt; only enrich remains.
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
                // The first video's thumbnail stands in as the record's cover
                // when a forced album finds no artwork of its own. Only the
                // first: they are per-video, and a playlist's cover should not
                // change with whichever track happened to finish last.
                if let Some(thumbnail) = as_string("thumbnail") {
                    update_job(app, inner, id, |j| {
                        j.thumbnail.get_or_insert(thumbnail);
                    })
                    .await;
                }
            }
            // The stop request killed this track's request; it did nothing
            // wrong, so it rejoins the pending set for a future retry. The
            // checkpoint at the top of the next iteration settles the job.
            Err(_) if cancel_requested(inner, id) => {
                update_track(app, inner, id, track.index, |t| {
                    t.status = TrackStatus::Pending;
                    t.error = None;
                })
                .await;
            }
            Err(err) => {
                // One dead video must not sink the album; the row shows it.
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

    // Import loop: singleton per file (the real album row is created by
    // enrich_album once every item is known).
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
                    // No item id = duplicate skipped by beets: nothing to enrich.
                    t.status = if item_id.is_some() {
                        TrackStatus::Imported
                    } else {
                        TrackStatus::Done
                    };
                })
                .await;
            }
            // Interrupted by the stop request, not broken: the staged file is
            // intact and a retry re-imports it.
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

    // Enrich: one album-wide request so a single MusicBrainz release covers
    // every track (coherent album name, one cover fetch).
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
                // Job-level failure: tracks keep `Imported`, so a retry
                // resumes straight at the enrich step.
                fail(app, inner, id, JobStep::Enrich, err).await;
                return;
            }
        }
    }

    // Final status from the per-track outcomes.
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    // Duplicates dropped by enrich have no item left to tag or to move.
    let kept: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.duplicate_of.is_none())
        .filter_map(|t| t.item_id)
        .collect();
    if let Some(category) = job.category.as_deref() {
        apply_category(app, id, category, &kept).await;
    }
    // An existing target only: a *new* forced album was already stood up by
    // the enrich step, cover hunt included.
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
    // Videos YouTube pulled out from under the playlist. Counted on the job so
    // the card can say the record has holes, and kept out of `failed`: nothing
    // went wrong here, and there is nothing to retry.
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

    // `Failed` means the batch produced nothing — a dead playlist, a network
    // that never answered. One dead video out of twenty-four is not that: the
    // run reached the end and the library gained twenty-three tracks, so the
    // job is `Done` and `error` carries the tally. Calling it failed made the
    // row paint its whole pipeline red and claim the import never happened.
    // Every video gone is a dead end, not a success with nothing in it: the
    // `failed == 0` branch below would otherwise call this run `Done`.
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
        // The earliest failing phase: a failed track without a staged file
        // never downloaded; with a file but no item it failed the import.
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

    // The key never transits through the webview; keychain → sidecar directly.
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

    // The category rides along so the cover lookup knows whether there is a
    // medium to search for; the thumbnail is the stand-in when there is not.
    // An *existing* target is not this path's business: the pipeline files
    // normally and `apply_destination` moves the items afterwards.
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
                "track_hints": track_hints,
                "fetch_pause_seconds": prefs.lastfm_fetch_delay_seconds,
                "lookup_pause_seconds": prefs.acoustid_lookup_delay_seconds,
            }),
            ENRICH_ALBUM_TIMEOUT,
        )
        .await
}

impl JobsState {
    /// Bring the worker to life. Its own step, after the launch migration —
    /// see [`init`].
    pub fn start(&self, app: AppHandle, worker: JobsWorker) {
        spawn_worker(app, self.0.clone(), worker.0);
    }

    /// A blocking touch of the DB, for the setup hook only: the worker is not
    /// born yet, the runtime is not being blocked, and `with_conn`'s
    /// spawn_blocking would be ceremony with nothing to protect.
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

    /// Stop a job. A queued one is settled on the spot; a running one gets its
    /// in-flight sidecar request killed — the worker's next checkpoint records
    /// the terminal state. Resume markers survive, so a retry can pick it up.
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
            // Nothing in flight to interrupt; write the terminal state here.
            // The flag stays armed on purpose: if the worker picked the job up
            // between our snapshot and this write, its next checkpoint wins;
            // otherwise `run_job` (or a retry) consumes the leftover.
            update_job(app, &self.0, id, |j| j.status = JobStatus::Cancelled).await;
        } else {
            // The worker is blocked on this job's request — the queue is
            // serial, so whatever the work channel is running belongs to this
            // job. Killing the process is the only way to interrupt it; the
            // channel restarts itself on the next request.
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
        // A cancel armed but never consumed (the job was already queued when it
        // arrived) must not shoot down the run it is now asked to redo.
        take_cancel(&self.0, id);
        // A partly-successful album is `Done` (see the album worker's final
        // status) yet still holds dead tracks worth another try, so "failed"
        // alone is too narrow a gate. A cancelled job is the user changing
        // their mind: it resumes from its per-track markers.
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
            // Failed tracks rejoin the batch; staged_path/item_id survive so
            // the album worker's skip conditions resume where each one left off.
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

    /// One job by id, tracks included.
    pub async fn get(&self, id: &str) -> AppResult<Option<Job>> {
        let owned = id.to_string();
        with_conn(&self.0, move |c| jobs_store::get_job(c, &owned)).await
    }

    /// Stamp a job undone and tell the front: the write is the fact, the emit
    /// is what flips the history row without a reload.
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

    /// Re-file what a settled job put in the library onto another record — the
    /// after-the-fact edition of the composer's destination option, for the
    /// playlist the pipeline split into albums it should not have.
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
        // The row records the filing the user last chose, so the history card
        // tells the story as it now stands.
        update_job(app, &self.0, id, move |j| j.forced_album = Some(forced))
            .await
            .ok_or_else(|| AppError::InvalidInput("unknown job".into()))
    }

    /// The live window — every moving job plus the most recent terminal ones.
    /// What the Downloads page and the in-flight checks read; the archive is
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

    /// The album rows a job still in flight is going to file its tracks into.
    ///
    /// Deleting one of them mid-download would take the move's destination out
    /// from under it: the tracks would land on whatever release the pipeline
    /// guessed, and the failure is logged rather than raised — so the guard has
    /// to sit in front of the delete, not behind it. Reads the live window,
    /// which already holds every moving job.
    pub async fn target_albums(&self) -> Vec<i64> {
        self.list()
            .await
            .iter()
            .filter(|job| !job.status.is_settled())
            .filter_map(|job| job.forced_album.as_ref()?.album_id)
            .collect()
    }

    /// One page of the whole archive, newest first, with the totals the
    /// history page paginates on. Unlike `list`, an unreadable store surfaces
    /// as an error: the page would otherwise claim an empty history.
    pub async fn page(&self, offset: u64, limit: u64) -> AppResult<jobs_store::JobsPage> {
        with_conn(&self.0, move |conn| {
            jobs_store::list_jobs_page(conn, offset, limit)
        })
        .await
    }

    /// File a finished library import in the same store the download history
    /// lives in — it is the app's own database, not the download feature's, and
    /// an import is the other way music enters the ark.
    ///
    /// Swallows: the import itself has already happened and its result is on its
    /// way back to the page. Losing the archive row is worth a log line, never
    /// turning a successful import into a reported failure.
    pub async fn record_import(&self, record: library_import::ImportRecord) {
        if let Err(err) = with_conn(&self.0, move |conn| {
            jobs_store::insert_import(conn, &record)
        })
        .await
        {
            eprintln!("[imports] recording failed: {err}");
        }
    }

    /// One archived import. Unlike `list_imports`, a failure is returned
    /// rather than logged and flattened: everything asking for a single row is
    /// about to act on it, and acting on "not found" and on "the archive is
    /// unreadable" are not the same decision.
    pub async fn get_import(&self, id: &str) -> AppResult<Option<library_import::ImportRecord>> {
        let id = id.to_string();
        with_conn(&self.0, move |conn| jobs_store::get_import(conn, &id)).await
    }

    /// Record that a run was taken back out. Logged rather than raised: the
    /// tracks are already gone, and a lost archive flag must not turn a
    /// completed undo into a reported failure.
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

    /// Drop every membership pointing at one of these items — a whole import
    /// left the library.
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

    /// Drop terminal (done/failed) jobs and the whole import archive; in-flight
    /// jobs are untouched. One sweep, because the history page shows both.
    pub async fn clear_history(&self) -> Vec<Job> {
        if let Err(err) = with_conn(&self.0, jobs_store::clear_history).await {
            eprintln!("[jobs] clear history failed: {err}");
        }
        self.list().await
    }

    // Artist images live in the same store (app/user state, not a fact about
    // an audio file); these thin wrappers keep the connection discipline —
    // every touch through `with_conn`, off the async runtime.

    pub async fn list_artist_images(&self) -> AppResult<Vec<jobs_store::ArtistImageRow>> {
        with_conn(&self.0, jobs_store::list_artist_images).await
    }

    /// Returns the replaced file's name, if the write orphaned one.
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

    /// Returns the removed row's filename, if there was one.
    pub async fn remove_artist_image(&self, name: String) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| jobs_store::remove_artist_image(c, &name)).await
    }

    /// Returns the filename left ownerless by the rename, if any. `filename`
    /// is the file's post-rename name — the caller renames it on disk first.
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

    // Playlists: same store, same discipline as artist images. Timestamps are
    // stamped here so the store functions stay pure over their inputs.

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

    /// Returns the cover filename left ownerless, if the playlist wore one.
    pub async fn delete_playlist(&self, id: i64) -> AppResult<Option<String>> {
        with_conn(&self.0, move |c| playlists::delete(c, id)).await
    }

    /// Returns the replaced file's name, if the write orphaned one.
    pub async fn set_playlist_cover(&self, id: i64, filename: String) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::set_cover(c, id, &filename, now)
        })
        .await
    }

    /// Repoint a cover row at its renamed file.
    pub async fn update_playlist_cover_filename(&self, id: i64, filename: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| {
            playlists::update_cover_filename(c, id, &filename, now)
        })
        .await
    }

    /// Returns the removed file's name, if there was one.
    pub async fn remove_playlist_cover(&self, id: i64) -> AppResult<Option<String>> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::remove_cover(c, id, now)).await
    }

    /// What the playlist wears in the navigation; an empty string clears it.
    pub async fn set_playlist_marker(&self, id: i64, marker: String) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::set_marker(c, id, &marker, now)).await
    }

    /// Returns (added, skipped-as-already-present).
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

    /// Returns how many rows actually went.
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

    /// Best-effort prune after a library delete — the caller logs, never fails
    /// the user's action over it.
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
            // The built-in list survives an erase as an *empty* list — it is
            // part of the app, only its contents belonged to the user.
            playlists::ensure_favorites(c, now)
        })
        .await
    }

    /// Empty every playlist without deleting any: the library-wipe companion,
    /// where the lists are kept but their item ids just stopped meaning
    /// anything.
    pub async fn clear_playlist_memberships(&self) -> AppResult<()> {
        let now = now_ms();
        with_conn(&self.0, move |c| playlists::clear_memberships(c, now)).await
    }
}
