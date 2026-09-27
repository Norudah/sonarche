//! What a download undo and an import undo share: the sidecar removal
//! (through beets), then the playlists beets doesn't know about.

use std::collections::HashSet;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::library_import::LibraryImportState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

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
pub struct SidecarReply {
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

/// Calls a sidecar undo command; `params` are added to the library paths.
pub async fn request(
    app: &AppHandle,
    sidecar: &SidecarState,
    command: &str,
    params: Value,
    timeout: Duration,
) -> AppResult<SidecarReply> {
    let paths = AppPaths::resolve(app)?;
    let mut body = json!({
        "beets_db": paths.beets_db.to_string_lossy(),
        "library_dir": paths.music_dir().to_string_lossy(),
    });
    if let (Some(body), Value::Object(extra)) = (body.as_object_mut(), params) {
        body.extend(extra);
    }
    let reply = sidecar.request(app, command, body, timeout).await?;
    Ok(serde_json::from_value(reply)?)
}

pub async fn preview(jobs: &JobsState, reply: SidecarReply) -> AppResult<UndoPreview> {
    let doomed: HashSet<i64> = reply.item_ids.into_iter().collect();
    Ok(UndoPreview {
        tracks: reply.tracks,
        albums_removed: reply.albums_removed,
        albums_kept: reply.albums_kept,
        playlist_entries: jobs.count_playlist_memberships(doomed).await? as u64,
    })
}

/// An import writing into the library would race the deletion.
pub async fn refuse_while_importing(imports: &LibraryImportState) -> AppResult<()> {
    if imports.is_running().await {
        return Err(AppError::InvalidInput(
            "an import is running; stop it first".into(),
        ));
    }
    Ok(())
}

/// Prunes the removed items from playlists. Runs after the removal: pruning
/// first and then failing would lose memberships of tracks that still exist.
pub async fn settle_playlists(
    app: &AppHandle,
    jobs: &JobsState,
    reply: SidecarReply,
) -> UndoOutcome {
    let doomed: HashSet<i64> = reply.item_ids.into_iter().collect();
    let playlist_entries = match jobs.prune_playlists(doomed).await {
        Ok(count) => count as u64,
        Err(err) => {
            eprintln!("[undo] playlist prune failed: {err}");
            0
        }
    };
    crate::playlists_mirror::sync(app, jobs).await;
    UndoOutcome {
        removed: reply.removed,
        foreign: reply.foreign,
        playlist_entries,
    }
}
