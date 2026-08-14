//! Taking one download back out of the library.
//!
//! The download twin of [`crate::import_undo`], addressed differently: a
//! download has no source folder and no beets mark — the item ids recorded on
//! the job row (`jobs.item_id`, `job_tracks.item_id`) are its only memory.
//! The removal itself is the sidecar's shared `undo_removal`, which goes
//! through beets so album rows, covers and emptied folders go with the
//! tracks. What belongs here is what beets does not know about:
//!
//! * playlists, which live in another database file and therefore cannot lose
//!   their members to a foreign key;
//! * the M3U8 mirror those playlists are written out to;
//! * the `undone_at` stamp on the job row, which is what stops a second undo
//!   and what the history card reads instead of asking the library;
//! * the refusal to run while a library import is writing.
//!
//! Unlike an import, a download undo destroys the only copy: the staged file
//! was consumed by the import, so nothing is coming back without downloading
//! again. The confirmation says so; this module makes its counts true.

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

/// Deleting at most a playlist's worth of files — minutes at the very worst,
/// but a walk over real IO, not a query.
const UNDO_TIMEOUT: Duration = Duration::from_secs(600);

/// What undoing a download would take away, counted from the library as it is
/// now: tracks may have been deleted by hand since, and an album may have
/// grown. The same shape as the import undo's preview, deliberately — the two
/// confirmations say the same kind of sentence.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoPreview {
    pub tracks: u64,
    /// Albums that disappear with their tracks.
    pub albums_removed: u64,
    /// Albums that merely lose some — the download had landed on a record
    /// that was already on the shelf.
    pub albums_kept: u64,
    /// Playlist entries that go with the tracks. Filled here, not by the
    /// sidecar: playlists are the app's, not beets'.
    #[serde(default)]
    pub playlist_entries: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoOutcome {
    pub removed: u64,
    /// Rows dropped whose file sat outside the library, so the file was left
    /// alone. Reported rather than swallowed — see the import undo.
    #[serde(default)]
    pub foreign: u64,
    /// Playlist entries removed along the way.
    #[serde(default)]
    pub playlist_entries: u64,
}

/// The sidecar's reply. `item_ids` never crosses to the front — its only
/// reader is the playlist prune.
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

/// The job, its recorded items, or the stated reason there is nothing to undo.
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
    // An import copying into the library while this deletes out of it would
    // race file by file, and beets holds one lock for both.
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

    // Best-effort, in this order, and after the removal — same reasoning as
    // the import undo: pruning first and then failing to remove would lose
    // memberships for tracks still there.
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
