//! Download job queue: one sequential worker drives each job through
//! `download → import`, persists state to app data, and pushes every
//! transition to the webview as a `jobs:updated` event.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::settings;
use crate::sidecar::SidecarState;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const IMPORT_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const ENRICH_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const PROBE_TIMEOUT: Duration = Duration::from_secs(3 * 60);
/// One request covers the whole album: N fingerprints + MB calls + covers.
const ENRICH_ALBUM_TIMEOUT: Duration = Duration::from_secs(20 * 60);
/// Random pause between two YouTube downloads of an album batch. Sequential
/// same-IP hammering is exactly what gets clients throttled or flagged.
const TRACK_SLEEP_RANGE_SECS: (f64, f64) = (3.0, 6.0);
const MAX_ALBUM_TRACKS: u64 = 100;
/// Persisted history cap; oldest terminal jobs are dropped past this.
const MAX_JOBS: usize = 200;

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
}

impl JobStatus {
    fn is_terminal(self) -> bool {
        matches!(self, JobStatus::Done | JobStatus::Failed)
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
    pub created_at: u64,
    pub updated_at: u64,
}

struct JobsInner {
    jobs: Mutex<Vec<Job>>,
    tx: mpsc::UnboundedSender<String>,
    store_path: PathBuf,
}

pub struct JobsState(Arc<JobsInner>);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn load_jobs(store_path: &PathBuf) -> Vec<Job> {
    let Ok(raw) = std::fs::read_to_string(store_path) else {
        return Vec::new();
    };
    match serde_json::from_str::<Vec<Job>>(&raw) {
        Ok(jobs) => jobs,
        Err(err) => {
            eprintln!(
                "[jobs] discarding unreadable {}: {err}",
                store_path.display()
            );
            Vec::new()
        }
    }
}

async fn persist(store_path: &PathBuf, jobs: &[Job]) {
    match serde_json::to_vec_pretty(jobs) {
        Ok(bytes) => {
            if let Err(err) = tokio::fs::write(store_path, bytes).await {
                eprintln!("[jobs] failed to persist queue: {err}");
            }
        }
        Err(err) => eprintln!("[jobs] failed to serialize queue: {err}"),
    }
}

/// Load persisted jobs, fail anything the previous run left unfinished,
/// and start the single worker task. Called once from Tauri setup.
pub fn init(app: &AppHandle) -> AppResult<JobsState> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let store_path = data_dir.join("jobs.json");

    let mut jobs = load_jobs(&store_path);
    let mut interrupted = false;
    for job in &mut jobs {
        if !job.status.is_terminal() {
            job.status = JobStatus::Failed;
            job.error = Some("interrupted by app restart".into());
            job.updated_at = now_ms();
            interrupted = true;
            // A track caught mid-download restarts from scratch; its
            // staged_path/item_id still encode any real progress.
            for track in &mut job.tracks {
                if track.status == TrackStatus::Downloading {
                    track.status = TrackStatus::Pending;
                }
            }
        }
    }
    if interrupted {
        if let Ok(bytes) = serde_json::to_vec_pretty(&jobs) {
            let _ = std::fs::write(&store_path, bytes);
        }
    }

    let (tx, rx) = mpsc::unbounded_channel();
    let inner = Arc::new(JobsInner {
        jobs: Mutex::new(jobs),
        tx,
        store_path,
    });
    spawn_worker(app.clone(), inner.clone(), rx);
    Ok(JobsState(inner))
}

fn spawn_worker(app: AppHandle, inner: Arc<JobsInner>, mut rx: mpsc::UnboundedReceiver<String>) {
    tauri::async_runtime::spawn(async move {
        while let Some(id) = rx.recv().await {
            run_job(&app, &inner, &id).await;
        }
    });
}

/// Apply a mutation to one job, persist the queue and broadcast the new state.
async fn update_job(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    mutate: impl FnOnce(&mut Job),
) -> Option<Job> {
    let mut jobs = inner.jobs.lock().await;
    let job = jobs.iter_mut().find(|j| j.id == id)?;
    mutate(job);
    job.updated_at = now_ms();
    let snapshot = job.clone();
    persist(&inner.store_path, &jobs).await;
    drop(jobs);
    let _ = app.emit("jobs:updated", &snapshot);
    Some(snapshot)
}

async fn snapshot(inner: &JobsInner, id: &str) -> Option<Job> {
    inner.jobs.lock().await.iter().find(|j| j.id == id).cloned()
}

/// Apply a mutation to one track of an album job (persists + broadcasts).
async fn update_track(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    index: u32,
    mutate: impl FnOnce(&mut AlbumTrack),
) -> Option<Job> {
    update_job(app, inner, id, |j| {
        if let Some(track) = j.tracks.iter_mut().find(|t| t.index == index) {
            mutate(track);
        }
    })
    .await
}

async fn run_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };
    match job.kind {
        JobKind::Album => run_album_job(app, inner, id).await,
        JobKind::Single => run_single_job(app, inner, id).await,
    }
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

    update_job(app, inner, id, |j| j.status = JobStatus::Enriching).await;
    match run_enrich(app, inner, id, item_id).await {
        Ok(result) => {
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

async fn fail(app: &AppHandle, inner: &JobsInner, id: &str, step: JobStep, err: AppError) {
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Failed;
        j.failed_step = Some(step);
        j.error = Some(err.to_string());
    })
    .await;
}

/// Raw sidecar download of one URL into the staging dir.
async fn download_request(app: &AppHandle, url: &str) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "download",
            json!({
                "url": url,
                "staging_dir": paths.staging_dir.to_string_lossy(),
            }),
            DOWNLOAD_TIMEOUT,
        )
        .await
}

async fn run_download(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    url: &str,
) -> AppResult<String> {
    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;
    let result = download_request(app, url).await?;

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
    let (title, artist) = inner
        .jobs
        .lock()
        .await
        .iter()
        .find(|j| j.id == id)
        .map(|j| (j.title.clone(), j.artist.clone()))
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
                "library_dir": paths.library_dir.to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "title": title,
                "artist": artist,
            }),
            ENRICH_TIMEOUT,
        )
        .await
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
                "library_dir": paths.library_dir.to_string_lossy(),
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
    let tracks = snapshot(inner, id)
        .await
        .map(|j| j.tracks)
        .unwrap_or_default();
    let mut downloaded_before = false;
    for track in &tracks {
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

        if downloaded_before {
            let (lo, hi) = TRACK_SLEEP_RANGE_SECS;
            let pause = lo + fastrand::f64() * (hi - lo);
            tokio::time::sleep(Duration::from_secs_f64(pause)).await;
        }
        downloaded_before = true;

        update_track(app, inner, id, track.index, |t| {
            t.status = TrackStatus::Downloading;
        })
        .await;
        match download_request(app, &track.url).await {
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
            }
            Err(err) => {
                // One dead video must not sink the album; the row shows it.
                let message = err.to_string();
                update_track(app, inner, id, track.index, |t| {
                    t.status = TrackStatus::Failed;
                    t.error = Some(message);
                })
                .await;
            }
        }
    }

    // Import loop: singleton per file (the real album row is created by
    // enrich_album once every item is known).
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
    let failed = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Failed)
        .count();
    if failed == 0 {
        update_job(app, inner, id, |j| j.status = JobStatus::Done).await;
        return;
    }
    // The earliest failing phase: a failed track without a staged file never
    // downloaded; with a file but no item it failed the import.
    let step = if job
        .tracks
        .iter()
        .any(|t| t.status == TrackStatus::Failed && t.staged_path.is_none())
    {
        JobStep::Download
    } else {
        JobStep::Import
    };
    let total = job.tracks.len();
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Failed;
        j.failed_step = Some(step);
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

    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "enrich_album",
            json!({
                "item_ids": item_ids,
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "album_title": job.title,
                "artist": job.artist,
                "track_hints": track_hints,
                "fetch_pause_seconds": prefs.lastfm_fetch_delay_seconds,
            }),
            ENRICH_ALBUM_TIMEOUT,
        )
        .await
}

impl JobsState {
    pub async fn enqueue(&self, app: &AppHandle, url: String, kind: JobKind) -> AppResult<Job> {
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
            created_at: now,
            updated_at: now,
        };

        let mut jobs = self.0.jobs.lock().await;
        jobs.push(job.clone());
        trim_history(&mut jobs);
        persist(&self.0.store_path, &jobs).await;
        drop(jobs);

        let _ = app.emit("jobs:updated", &job);
        self.0
            .tx
            .send(job.id.clone())
            .map_err(|_| AppError::Sidecar("job worker is not running".into()))?;
        Ok(job)
    }

    pub async fn retry(&self, app: &AppHandle, id: &str) -> AppResult<Job> {
        {
            let jobs = self.0.jobs.lock().await;
            let job = jobs
                .iter()
                .find(|j| j.id == id)
                .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
            if job.status != JobStatus::Failed {
                return Err(AppError::InvalidInput(
                    "job is not in a failed state".into(),
                ));
            }
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

    pub async fn list(&self) -> Vec<Job> {
        let mut jobs = self.0.jobs.lock().await.clone();
        jobs.sort_by_key(|j| std::cmp::Reverse(j.created_at));
        jobs
    }

    /// Drop terminal (done/failed) jobs from the history; in-flight jobs are untouched.
    pub async fn clear_history(&self) -> Vec<Job> {
        let mut jobs = self.0.jobs.lock().await;
        jobs.retain(|j| !j.status.is_terminal());
        persist(&self.0.store_path, &jobs).await;
        let mut remaining = jobs.clone();
        remaining.sort_by_key(|j| std::cmp::Reverse(j.created_at));
        remaining
    }
}

/// Drop the oldest terminal jobs once the history exceeds the cap.
fn trim_history(jobs: &mut Vec<Job>) {
    while jobs.len() > MAX_JOBS {
        let oldest_terminal = jobs
            .iter()
            .enumerate()
            .filter(|(_, j)| j.status.is_terminal())
            .min_by_key(|(_, j)| j.created_at)
            .map(|(i, _)| i);
        match oldest_terminal {
            Some(index) => {
                jobs.remove(index);
            }
            None => break,
        }
    }
}
