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
use crate::python_env::{self, AppPaths};
use crate::settings;
use crate::sidecar::SidecarState;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const IMPORT_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const ENRICH_TIMEOUT: Duration = Duration::from_secs(5 * 60);
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

async fn run_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = inner.jobs.lock().await.iter().find(|j| j.id == id).cloned() else {
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
        match run_import(app, &path).await {
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

async fn run_download(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    url: &str,
) -> AppResult<String> {
    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    let result = sidecar
        .request(
            app,
            "download",
            json!({
                "url": url,
                "staging_dir": paths.staging_dir.to_string_lossy(),
            }),
            DOWNLOAD_TIMEOUT,
        )
        .await?;

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

    let hints = inner
        .jobs
        .lock()
        .await
        .iter()
        .find(|j| j.id == id)
        .map(|j| (j.title.clone(), j.artist.clone()))
        .unwrap_or((None, None));

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
                "title": hints.0,
                "artist": hints.1,
            }),
            ENRICH_TIMEOUT,
        )
        .await
}

async fn run_import(app: &AppHandle, path: &str) -> AppResult<Value> {
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
            }),
            IMPORT_TIMEOUT,
        )
        .await
}

impl JobsState {
    pub async fn enqueue(&self, app: &AppHandle, url: String) -> AppResult<Job> {
        let now = now_ms();
        let job = Job {
            id: Uuid::new_v4().to_string(),
            url,
            kind: JobKind::Single,
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
