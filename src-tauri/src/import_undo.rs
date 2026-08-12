//! Taking one import back out of the library.
//!
//! The removal itself is the sidecar's (`sidecar/import_undo.py`), which goes
//! through beets so the album row, the cover and the emptied folders go with
//! the tracks. What belongs here is everything beets does not know about:
//!
//! * the archive row, which says which folder the run read — the only place
//!   that remembers it, and what the sidecar needs to clear beets' incremental
//!   memory so the same folder can be imported again;
//! * playlists, which live in another database file and therefore cannot lose
//!   their members to a foreign key;
//! * the M3U8 mirror those playlists are written out to;
//! * the refusal to do any of this while an import is running.
//!
//! Undoing destroys nothing that exists only here: an import copies, and the
//! folder it read was never touched. What it does destroy is everything done
//! to those tracks *since* — corrected tags, replaced covers, playlist
//! membership. The confirmation says so; this module only makes the count it
//! says it with true.

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

/// Deleting a few thousand files and their now-empty folders. Far shorter than
/// the import's six hours — nothing here copies bytes — and far longer than a
/// query, because it is a walk over everything one run brought in.
const UNDO_TIMEOUT: Duration = Duration::from_secs(1800);

/// What undoing a run would take away, counted from the library as it is now
/// and not from what the run once reported: tracks may have been deleted by
/// hand since, and an album may have grown.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoPreview {
    pub tracks: u64,
    /// Albums that disappear with their tracks.
    pub albums_removed: u64,
    /// Albums that merely lose some — the run had added to a record that was
    /// already on the shelf. Its own number because it is the consequence
    /// nobody expects.
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
    /// alone. Nothing an import created can be there; it is reported rather
    /// than swallowed because it is the one case where "everything this import
    /// brought in is gone" would be a lie.
    #[serde(default)]
    pub foreign: u64,
    /// Playlist entries removed along the way.
    #[serde(default)]
    pub playlist_entries: u64,
}

/// The sidecar's own reply shape. `item_ids` never crosses to the front — it
/// is thousands of integers whose only reader is the playlist prune.
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

/// The archive row, or a stated error. Every path through this module needs it
/// — the folder it holds is what makes an undo repeatable.
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
                "library_import_undo",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "import_id": archived.id,
                    // What beets remembers taking, and from where. Without both
                    // the next import of this folder would skip every directory
                    // it recognises and report bringing in nothing.
                    "state_file": paths.beets_import_state.to_string_lossy(),
                    "folder": archived.folder,
                }),
                UNDO_TIMEOUT,
            )
            .await?,
    )?;

    // Best-effort, in this order, and after the removal: the library is the
    // truth, and a playlist still naming a track that no longer exists is a
    // stale row the front already tolerates. The reverse — pruning first and
    // then failing to remove — would lose memberships for tracks still there.
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
