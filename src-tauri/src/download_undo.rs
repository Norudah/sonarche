//! Undoing one download.
//!
//! The job row's item ids are the only record of what it filed. Removal goes
//! through the sidecar's `undo_removal` (beets); this module handles what
//! beets doesn't know: playlists, their M3U8 mirror, the job's `undone_at`
//! stamp, and refusing while an import runs. Unlike an import undo, this
//! deletes the only copy.

use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::jobs::{self, Job, JobsState};
use crate::library_import::LibraryImportState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

const UNDO_TIMEOUT: Duration = Duration::from_secs(600);

/// What undoing would remove, counted from the current library. Same shape
/// as the import undo preview.
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

/// The job and its recorded items, or why there is nothing to undo.
async fn undoable(jobs: &JobsState, id: &str) -> AppResult<(Job, Vec<i64>)> {
    let job = jobs
        .get(id)
        .await?
        .ok_or_else(|| AppError::InvalidInput("unknown job".into()))?;
    if !job.status.is_settled() {
        return Err(AppError::InvalidInput("job is still running".into()));
    }
    let item_ids = jobs::library_item_ids(&job);
    if item_ids.is_empty() {
        return Err(AppError::InvalidInput(
            "this download filed nothing in the library".into(),
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
    let (_, item_ids) = undoable(jobs, id).await?;
    let paths = AppPaths::resolve(app)?;
    let reply: SidecarReply = serde_json::from_value(
        sidecar
            .request(
                app,
                "library_download_undo_preview",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "item_ids": item_ids,
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
    let (job, item_ids) = undoable(jobs, id).await?;
    if job.undone_at.is_some() {
        return Err(AppError::InvalidInput(
            "this download was already undone".into(),
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
                "library_download_undo",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "item_ids": item_ids,
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
            eprintln!("[download_undo] playlist prune failed: {err}");
            0
        }
    };
    crate::playlists_mirror::sync(app, jobs).await;
    jobs.mark_undone(app, id, now_ms()).await?;

    Ok(UndoOutcome {
        removed: reply.removed,
        foreign: reply.foreign,
        playlist_entries,
    })
}
