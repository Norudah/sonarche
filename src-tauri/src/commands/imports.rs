//! Library imports from a local folder.

use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::import_undo;
use crate::jobs::JobsState;
use crate::library_import::{ImportOutcome, ImportRecord, LibraryImportState};
use crate::library_scan::{self, ScanReport};
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;
use crate::undo;

use super::checked_category;

/// Scans a folder the user may import. Read-only, off the async runtime.
#[tauri::command]
pub async fn scan_import_folder(
    app: AppHandle,
    state: State<'_, LibraryImportState>,
    jobs: State<'_, JobsState>,
    path: String,
) -> AppResult<ScanReport> {
    let root = PathBuf::from(&path);
    library_scan::ensure_outside_library(&root, &AppPaths::resolve(&app)?.library_root)?;

    let scanned = root.clone();
    let mut report = tokio::task::spawn_blocking(move || library_scan::scan(&scanned))
        .await
        .map_err(|err| AppError::Sidecar(format!("scan task panicked: {err}")))??;

    report.previously_imported =
        crate::library_import::overlapping_import(&jobs.list_imports().await, &root).map(
            |record| library_scan::PreviousImport {
                cancelled: matches!(
                    record.status,
                    crate::library_import::ImportStatus::Cancelled
                ),
                folder: record.folder,
                finished_at: record.finished_at,
            },
        );

    // Remembered so the import is archived with counts measured here, not
    // values sent back by the webview.
    state.remember_scan(&root, &report).await;
    Ok(report)
}

/// Copies a folder's music into the library; progress arrives as sidecar
/// `library_import_progress` events.
#[tauri::command]
pub async fn start_library_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    state: State<'_, LibraryImportState>,
    folder: String,
    grouping: Option<String>,
    category: Option<String>,
) -> AppResult<ImportOutcome> {
    let grouping = grouping.unwrap_or_else(|| "folder".into());
    let category = checked_category(category)?;
    state
        .run(
            &app,
            &sidecar,
            &jobs,
            &folder,
            &grouping,
            category.as_deref(),
        )
        .await
}

/// Every finished library import, newest first.
#[tauri::command]
pub async fn list_imports(jobs: State<'_, JobsState>) -> AppResult<Vec<ImportRecord>> {
    Ok(jobs.list_imports().await)
}

/// Signals the running import to stop; the import call resolves as cancelled.
#[tauri::command]
pub async fn cancel_library_import(state: State<'_, LibraryImportState>) -> AppResult<()> {
    state.cancel().await
}

/// What undoing this import would remove, counted from the current library.
#[tauri::command]
pub async fn preview_import_undo(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: String,
) -> AppResult<undo::UndoPreview> {
    import_undo::preview(&app, &sidecar, &jobs, &id).await
}

/// Removes one import's tracks, emptied albums, covers, playlist entries and
/// beets' memory of the folder.
#[tauri::command]
pub async fn undo_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    imports: State<'_, LibraryImportState>,
    id: String,
) -> AppResult<undo::UndoOutcome> {
    import_undo::run(&app, &sidecar, &jobs, &imports, &id).await
}
