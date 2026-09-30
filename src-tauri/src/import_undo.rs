//! Undoing one library import.
//!
//! Removal is `sidecar/import_undo.py` (through beets), playlist pruning is in
//! `undo`. This module adds the archive row: its source folder clears beets'
//! incremental state. The source folder is untouched; edits made since the
//! import are lost.

use std::time::Duration;

use serde_json::json;
use tauri::AppHandle;

use crate::clock::now_ms;
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::library_import::LibraryImportState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;
use crate::undo::{self, UndoOutcome, UndoPreview};

const UNDO_TIMEOUT: Duration = Duration::from_secs(1800);

/// The archive row, whose source folder the undo needs.
async fn record(jobs: &JobsState, id: &str) -> AppResult<crate::library_import::ImportRecord> {
    jobs.get_import(id)
        .await?
        .ok_or_else(|| AppError::InvalidInput("no such import".into()))
}

pub async fn preview(
    app: &AppHandle,
    sidecar: &SidecarState,
    jobs: &JobsState,
    id: &str,
) -> AppResult<UndoPreview> {
    let archived = record(jobs, id).await?;
    let params = json!({ "import_id": archived.id });
    let reply = undo::request(
        app,
        sidecar,
        "library_import_undo_preview",
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
    let archived = record(jobs, id).await?;
    if archived.undone_at.is_some() {
        return Err(AppError::InvalidInput(
            "this import was already undone".into(),
        ));
    }
    undo::refuse_while_importing(imports).await?;

    let paths = AppPaths::resolve(app)?;
    let params = json!({
        "import_id": archived.id,
        // Lets the same folder be imported again.
        "state_file": paths.beets_import_state.to_string_lossy(),
        "folder": archived.folder,
    });
    let reply = undo::request(app, sidecar, "library_import_undo", params, UNDO_TIMEOUT).await?;
    let outcome = undo::settle_playlists(app, jobs, reply).await;
    jobs.mark_import_undone(&archived.id, now_ms()).await;
    Ok(outcome)
}
