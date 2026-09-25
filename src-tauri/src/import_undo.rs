//! Undoing one library import.
//!
//! Removal is `sidecar/import_undo.py` (through beets). This module handles
//! what beets doesn't know: the archive row (the source folder, needed to
//! clear beets' incremental state), playlists and their M3U8 mirror, and
//! refusing while an import runs. The source folder is untouched; edits made
//! since the import are lost.

use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::library_import::LibraryImportState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

const UNDO_TIMEOUT: Duration = Duration::from_secs(1800);

/// What undoing would remove, counted from the current library.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoPreview {
    pub tracks: u64,
    pub albums_removed: u64,
    /// Albums that only lose some tracks.
    pub albums_kept: u64,
    /// Filled here: playlists are the app's, not beets'.
    #[serde(default)]
    pub playlist_entries: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoOutcome {
    pub removed: u64,
    /// Rows dropped while their file, outside the library, was left alone.
    #[serde(default)]
    pub foreign: u64,
    #[serde(default)]
    pub playlist_entries: u64,
}

/// `item_ids` is only used to prune playlists.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarReply {
    #[serde(default)]
    tracks: u64,
    #[serde(default)]
    albums_removed: u64,
    #[serde(default)]
    albums_kept: u64,
    #[serde(default)]
    removed: u64,
    #[serde(default)]
    foreign: u64,
    #[serde(default)]
    item_ids: Vec<i64>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

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
    let paths = AppPaths::resolve(app)?;
    let reply: SidecarReply = serde_json::from_value(
        sidecar
            .request(
                app,
                "library_import_undo_preview",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "import_id": archived.id,
                }),
                UNDO_TIMEOUT,
            )
            .await?,
    )?;

    let doomed: HashSet<i64> = reply.item_ids.into_iter().collect();
    Ok(UndoPreview {
        tracks: reply.tracks,
        albums_removed: reply.albums_removed,
        albums_kept: reply.albums_kept,
        playlist_entries: jobs.count_playlist_memberships(doomed).await? as u64,
    })
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
    // An import writing into the library would race the deletion.
    if imports.is_running().await {
        return Err(AppError::InvalidInput(
            "an import is running; stop it first".into(),
        ));
    }

    let paths = AppPaths::resolve(app)?;
    let reply: SidecarReply = serde_json::from_value(
        sidecar
            .request(
                app,
                "library_import_undo",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "import_id": archived.id,
                    // Lets the same folder be imported again.
                    "state_file": paths.beets_import_state.to_string_lossy(),
                    "folder": archived.folder,
                }),
                UNDO_TIMEOUT,
            )
            .await?,
    )?;

    // After the removal: pruning first and then failing would lose memberships
    // of tracks that still exist.
    let doomed: HashSet<i64> = reply.item_ids.into_iter().collect();
    let playlist_entries = match jobs.prune_playlists(doomed).await {
        Ok(count) => count as u64,
        Err(err) => {
            eprintln!("[import_undo] playlist prune failed: {err}");
            0
        }
    };
    crate::playlists_mirror::sync(app, jobs).await;
    jobs.mark_import_undone(&archived.id, now_ms()).await;

    Ok(UndoOutcome {
        removed: reply.removed,
        foreign: reply.foreign,
        playlist_entries,
    })
}
