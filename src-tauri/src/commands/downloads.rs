//! Download queue and history.

use tauri::{AppHandle, State};

use crate::download_undo;
use crate::error::{AppError, AppResult};
use crate::jobs::{ForcedAlbum, Job, JobKind, JobsState};
use crate::library_import::LibraryImportState;
use crate::sidecar::SidecarState;

use super::checked_category;

/// Bounds a forced album's title and artist; soundtrack titles run long.
const MAX_ALBUM_CHARS: usize = 300;

#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, JobsState>,
    url: String,
    kind: Option<JobKind>,
    category: Option<String>,
    forced_album: Option<ForcedAlbum>,
    single_album: Option<bool>,
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    let category = checked_category(category)?;
    // No title means no forced album, not an error.
    let forced_album = match forced_album {
        Some(forced) => {
            let title = forced.title.trim().to_string();
            let artist = forced
                .artist
                .map(|a| a.trim().to_string())
                .filter(|a| !a.is_empty());
            if forced.album_id.is_some_and(|id| id <= 0) {
                return Err(AppError::InvalidInput("invalid target album".into()));
            }
            if title.is_empty() {
                None
            } else if title.chars().count() > MAX_ALBUM_CHARS
                || artist
                    .as_ref()
                    .is_some_and(|a| a.chars().count() > MAX_ALBUM_CHARS)
            {
                return Err(AppError::InvalidInput(
                    "forced album name is too long".into(),
                ));
            } else {
                Some(ForcedAlbum {
                    title,
                    artist,
                    album_id: forced.album_id,
                })
            }
        }
        None => None,
    };
    state
        .enqueue(
            &app,
            url,
            kind.unwrap_or(JobKind::Single),
            category,
            forced_album,
            single_album.unwrap_or(true),
        )
        .await
}

#[tauri::command]
pub async fn list_jobs(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.list().await)
}

/// One page of the download archive, newest first. The limit is clamped.
#[tauri::command]
pub async fn list_jobs_page(
    state: State<'_, JobsState>,
    offset: u64,
    limit: u64,
) -> AppResult<crate::jobs_store::JobsPage> {
    state.page(offset, limit.clamp(1, 100)).await
}

/// Albums an in-flight download targets, for the library's delete guard.
#[tauri::command]
pub async fn download_target_albums(state: State<'_, JobsState>) -> AppResult<Vec<i64>> {
    Ok(state.target_albums().await)
}

#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, JobsState>, id: String) -> AppResult<Job> {
    state.retry(&app, &id).await
}

#[tauri::command]
pub async fn cancel_job(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    id: String,
) -> AppResult<Job> {
    state.cancel(&app, &sidecar, &id).await
}

#[tauri::command]
pub async fn clear_job_history(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.clear_history().await)
}

/// What undoing this download would remove, counted from the current library.
#[tauri::command]
pub async fn preview_download_undo(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: String,
) -> AppResult<download_undo::UndoPreview> {
    download_undo::preview(&app, &sidecar, &jobs, &id).await
}

/// Removes one download's tracks and what empties with them. The history row
/// stays, marked as undone.
#[tauri::command]
pub async fn undo_download(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    imports: State<'_, LibraryImportState>,
    id: String,
) -> AppResult<download_undo::UndoOutcome> {
    download_undo::run(&app, &sidecar, &jobs, &imports, &id).await
}

/// Re-files a finished download's tracks onto another album.
#[tauri::command]
pub async fn change_job_destination(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: String,
    forced_album: crate::jobs::ForcedAlbum,
) -> AppResult<Job> {
    jobs.change_destination(&app, &id, forced_album).await
}
