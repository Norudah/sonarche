//! Library location, repairs, conversion and resets.

use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::convert::ConvertLibraryState;
use crate::error::AppResult;
use crate::jobs::JobsState;
use crate::library_move;
use crate::remux::RemuxState;
use crate::reset::{self, ResetTargets};
use crate::sidecar::SidecarState;

/// Remuxes fragmented DASH m4a files into classic MP4. Run once per launch.
#[tauri::command]
pub async fn remux_library(app: AppHandle, state: State<'_, RemuxState>) -> AppResult<Value> {
    state.run(&app).await
}

/// Re-encodes the library into the configured format. Long-running; each
/// original is deleted once its replacement is written.
#[tauri::command]
pub async fn convert_library(
    app: AppHandle,
    state: State<'_, ConvertLibraryState>,
) -> AppResult<Value> {
    state.run(&app).await
}

#[tauri::command]
pub async fn get_library_location(app: AppHandle) -> AppResult<library_move::LibraryLocation> {
    library_move::location(&app)
}

/// Preflight for a library move; the move itself re-checks.
#[tauri::command]
pub async fn check_library_move(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    parent: String,
) -> AppResult<library_move::MoveCheck> {
    library_move::check(&app, &jobs, PathBuf::from(parent)).await
}

/// Moves the music to `parent`/Sonarche. Stops playback and the sidecar
/// first; refused while a download or import runs.
#[tauri::command]
pub async fn move_library(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    parent: String,
) -> AppResult<library_move::LibraryLocation> {
    library_move::perform(&app, &jobs, &sidecar, PathBuf::from(parent)).await
}

/// Erases all user data. Refused while a download or import runs.
#[tauri::command]
pub async fn erase_all_data(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::erase_data(&app, &jobs, &sidecar).await
}

/// Erases the music and its index, keeping artist images, playlist names and
/// histories. Refused while a download or import runs.
#[tauri::command]
pub async fn erase_library(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::erase_library(&app, &jobs, &sidecar).await
}

/// Removes every artist image (files and rows).
#[tauri::command]
pub async fn erase_artist_images(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<()> {
    reset::erase_artist_images(&app, &jobs).await
}

/// Removes every playlist (rows, covers, M3U8 mirror). The music stays.
#[tauri::command]
pub async fn erase_playlists(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<()> {
    reset::erase_playlists(&app, &jobs).await
}

/// Removes the Python environment and tools; the walkthrough rebuilds them.
#[tauri::command]
pub async fn reinstall_environment(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::reinstall_environment(&app, &sidecar).await
}

/// Dev-only: resets what the app can rebuild. Never the library.
#[tauri::command]
pub async fn reset_setup_dev(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    targets: ResetTargets,
) -> AppResult<()> {
    reset::reset_setup(&app, &state, &sidecar, targets).await
}

/// Dev-only: wipes the music library. Refused in release builds.
#[tauri::command]
pub async fn reset_library_dev(app: AppHandle) -> AppResult<()> {
    reset::reset_library(&app).await
}
