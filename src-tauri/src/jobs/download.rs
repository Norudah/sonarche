//! The download step: one URL through yt-dlp, with retries.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::sidecar::SidecarState;

use super::model::JobStatus;
use super::{cancel_requested, job_log, update_job, update_track, JobsInner};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// The source's 403s are usually transient throttling.
const DOWNLOAD_ATTEMPTS: u32 = 3;

/// Doubles per attempt.
const DOWNLOAD_RETRY_PAUSE_SECS: u64 = 6;

/// Set by `sidecar/download.py` on videos the source will never serve.
const UNAVAILABLE_PREFIX: &str = "video-unavailable:";

pub(super) fn is_unavailable(message: &str) -> bool {
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
pub(super) enum AttemptTarget {
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
pub(super) async fn download_with_retry(
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

pub(super) async fn run_download(
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
