//! The job queue's public API: enqueue, cancel, retry, history and the import archive.

use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::db;
use crate::error::{AppError, AppResult};
use crate::library_import;
use crate::sidecar::SidecarState;

use super::filing::move_to_destination;
use super::model::{ForcedAlbum, Job, JobKind, JobStatus, TrackStatus};
use super::owned::owned_item_ids;
use super::{
    now_ms, request_cancel, snapshot, spawn_worker, take_cancel, update_job, with_conn, JobsState,
    JobsWorker,
};
use crate::python_env::AppPaths;

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
        with_conn(&self.0, move |c| db::jobs::upsert_job(c, &to_write)).await?;

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
        with_conn(&self.0, move |c| db::jobs::get_job(c, &owned)).await
    }

    pub async fn mark_undone(&self, app: &AppHandle, id: &str, when: u64) -> AppResult<Job> {
        let owned = id.to_string();
        with_conn(&self.0, move |c| db::jobs::mark_job_undone(c, &owned, when)).await?;
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
        let item_ids = owned_item_ids(AppPaths::resolve(app)?.beets_db, &job).await?;
        if item_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "nothing this download filed is still in the library".into(),
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
            db::jobs::list_live_jobs(conn, db::jobs::LIVE_TERMINAL_WINDOW)
        })
        .await
        {
            Ok(jobs) => jobs,
            Err(err) => {
                log_line!("[jobs] list failed: {err}");
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
    pub async fn page(&self, offset: u64, limit: u64) -> AppResult<db::jobs::JobsPage> {
        with_conn(&self.0, move |conn| {
            db::jobs::list_jobs_page(conn, offset, limit)
        })
        .await
    }

    /// Archives a finished library import. Errors are only logged: the import
    /// itself succeeded.
    pub async fn record_import(&self, record: library_import::ImportRecord) {
        if let Err(err) = with_conn(&self.0, move |conn| {
            db::imports::insert_import(conn, &record)
        })
        .await
        {
            log_line!("[imports] recording failed: {err}");
        }
    }

    /// One archived import; unlike `list_imports`, errors are returned.
    pub async fn get_import(&self, id: &str) -> AppResult<Option<library_import::ImportRecord>> {
        let id = id.to_string();
        with_conn(&self.0, move |conn| db::imports::get_import(conn, &id)).await
    }

    /// Errors are only logged: the tracks are already removed.
    pub async fn mark_import_undone(&self, id: &str, when: u64) {
        let owned = id.to_string();
        if let Err(err) = with_conn(&self.0, move |conn| {
            db::imports::mark_import_undone(conn, &owned, when)
        })
        .await
        {
            log_line!("[imports] marking {id} undone failed: {err}");
        }
    }

    pub async fn list_imports(&self) -> Vec<library_import::ImportRecord> {
        match with_conn(&self.0, db::imports::list_imports).await {
            Ok(records) => records,
            Err(err) => {
                log_line!("[imports] list failed: {err}");
                Vec::new()
            }
        }
    }

    /// Drops finished jobs and the import archive; running jobs are kept.
    pub async fn clear_history(&self) -> Vec<Job> {
        if let Err(err) = with_conn(&self.0, db::clear_history).await {
            log_line!("[jobs] clear history failed: {err}");
        }
        self.list().await
    }
}
