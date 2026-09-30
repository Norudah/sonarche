//! The single-track pipeline.

use serde_json::Value;
use tauri::AppHandle;

use super::download::run_download;
use super::filing::{apply_category, apply_destination, run_enrich, run_import};
use super::model::{JobStatus, JobStep};
use super::{fail, job_log, settle_cancel, snapshot, update_job, JobsInner};

pub(super) async fn run_single_job(app: &AppHandle, inner: &JobsInner, id: &str) {
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
