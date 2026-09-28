//! Undoing one download.
//!
//! The job row's item ids are the only record of what it filed; the shared
//! removal and playlist pruning live in `undo`. This module adds the job's
//! `undone_at` stamp. Unlike an import undo, this deletes the only copy.

use std::time::Duration;

use serde_json::json;
use tauri::AppHandle;

use crate::clock::now_ms;
use crate::error::{AppError, AppResult};
use crate::jobs::{self, Job, JobsState};
use crate::library_import::LibraryImportState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;
use crate::undo::{self, UndoOutcome, UndoPreview};

const UNDO_TIMEOUT: Duration = Duration::from_secs(600);

/// The job and its recorded items, or why there is nothing to undo.
async fn undoable(app: &AppHandle, jobs: &JobsState, id: &str) -> AppResult<(Job, Vec<i64>)> {
    let job = jobs
        .get(id)
        .await?
        .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
    if !job.status.is_settled() {
        return Err(AppError::InvalidInput("job is still running".into()));
    }
    // Only ids that still name what it filed: an emptied library reuses them.
    let item_ids = jobs::owned_item_ids(AppPaths::resolve(app)?.beets_db, &job).await?;
    if item_ids.is_empty() {
        return Err(AppError::InvalidInput(
            "nothing this download filed is still in the library".into(),
        ));
    }
    Ok((job, item_ids))
}

pub async fn preview(
    app: &AppHandle,
    sidecar: &SidecarState,
    jobs: &JobsState,
    id: &str,
) -> AppResult<UndoPreview> {
    let (_, item_ids) = undoable(app, jobs, id).await?;
    let params = json!({ "item_ids": item_ids });
    let reply = undo::request(
        app,
        sidecar,
        "library_download_undo_preview",
        params,
        UNDO_TIMEOUT,
    )
    .await?;
    undo::preview(jobs, reply).await
}

pub async fn run(
    app: &AppHandle,
    sidecar: &SidecarState,
    jobs: &JobsState,
    imports: &LibraryImportState,
    id: &str,
) -> AppResult<UndoOutcome> {
    let (job, item_ids) = undoable(app, jobs, id).await?;
    if job.undone_at.is_some() {
        return Err(AppError::InvalidInput(
            "this download was already undone".into(),
        ));
    }
    undo::refuse_while_importing(imports).await?;

    let params = json!({ "item_ids": item_ids });
    let reply = undo::request(app, sidecar, "library_download_undo", params, UNDO_TIMEOUT).await?;
    let outcome = undo::settle_playlists(app, jobs, reply).await;
    jobs.mark_undone(app, id, now_ms()).await?;
    Ok(outcome)
}
