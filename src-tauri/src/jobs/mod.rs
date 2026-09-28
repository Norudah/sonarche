//! Download job queue: one sequential worker drives each job through
//! `download → import → enrich`, persists state, and emits `jobs:updated`.

mod album;
mod download;
mod filing;
mod model;
mod queue;
mod single;
mod store;

pub use filing::{enrich_item, library_item_ids};
pub use model::{AlbumTrack, ForcedAlbum, Job, JobKind, JobStatus, JobStep, TrackStatus};

use std::collections::HashSet;
use std::sync::{Arc, Mutex as StdMutex};

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

use crate::clock::now_ms;
use crate::error::{AppError, AppResult};
use crate::jobs_store;
use crate::playlists;

use album::run_album_job;
use single::run_single_job;

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
        log_line!("[playlists] favorites seed failed: {err}");
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
                    log_line!("[jobs] migrated {} job(s) from jobs.json", jobs.len());
                }
                Err(err) => log_line!("[jobs] legacy import failed, keeping jobs.json: {err}"),
            },
            None => log_line!("[jobs] could not read legacy jobs.json; leaving it in place"),
        }
    }

    if let Ok(true) = jobs_store::fail_interrupted(&conn, now_ms()) {
        log_line!("[jobs] marked interrupted job(s) as failed");
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
            log_line!("[jobs] snapshot failed: {err}");
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
        log_line!("[jobs] persist failed: {err}");
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
        log_line!("[jobs] track persist failed: {err}");
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
    log_line!("[job {}] {msg}", &id[..id.len().min(8)]);
}
