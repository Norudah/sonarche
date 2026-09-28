//! Reading and editing the library's tracks.

use std::collections::HashMap;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::lyrics;
use crate::python_env::AppPaths;
use crate::reenrich::ReenrichState;
use crate::sidecar::SidecarState;

use super::QUERY_TIMEOUT;

/// Extensions the engine can decode. Constant for the build.
#[tauri::command]
pub fn playable_extensions() -> Vec<String> {
    crate::audio_formats::playable_extensions()
}

#[tauri::command]
pub async fn list_library(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> AppResult<Box<RawValue>> {
    let paths = AppPaths::resolve(&app)?;
    // The read channel, so listing never waits behind a download.
    state
        .read(
            &app,
            "library_list",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
            }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Editable tags, by beets attribute name (also the sidecar wire contract).
const EDITABLE_FIELDS: &[&str] = &[
    "title",
    "artist",
    "albumartist",
    "album",
    "year",
    "track",
    "tracktotal",
    "genre",
    "grouping",
];

#[derive(Deserialize)]
pub struct TrackUpdate {
    id: i64,
    fields: HashMap<String, Value>,
}

/// Edits a batch of tracks in one sidecar round-trip. The whole batch is
/// validated first, so one bad field rejects it without partial writes.
#[tauri::command]
pub async fn update_tracks(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    updates: Vec<TrackUpdate>,
) -> AppResult<Value> {
    if updates.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }
    let mut wire = Vec::with_capacity(updates.len());
    for update in &updates {
        if update.fields.is_empty() {
            continue;
        }
        for key in update.fields.keys() {
            if !EDITABLE_FIELDS.contains(&key.as_str()) {
                return Err(AppError::InvalidInput(format!("unknown field: {key}")));
            }
        }
        wire.push(json!({ "id": update.id, "fields": update.fields }));
    }
    if wire.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_update",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "updates": wire,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    // Carry the artist image across albumartist renames. Best-effort.
    crate::artist_images::follow_renames(&app, &jobs, &result).await;
    // Artist or album edits move files.
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

#[tauri::command]
pub async fn delete_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_remove",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "id": id,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    // Playlists live in another database; prune them here. Best-effort.
    if let Err(err) = jobs.remove_item_from_playlists(id).await {
        log_line!("[playlists] prune of item {id} failed: {err}");
    }
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

#[tauri::command]
pub async fn reenrich_track(
    app: AppHandle,
    state: State<'_, ReenrichState>,
    id: i64,
) -> AppResult<Value> {
    let result = state.run(&app, id).await?;
    // Re-enriching can rename the file.
    crate::playlists_mirror::sync_after_library_change(&app).await;
    Ok(result)
}

/// One track's lyrics. Without `allow_network` only stored lyrics are read.
/// `force` skips stored lyrics without erasing them.
#[tauri::command]
pub async fn fetch_lyrics(
    app: AppHandle,
    id: i64,
    allow_network: bool,
    force: bool,
) -> AppResult<Value> {
    lyrics::fetch(&app, id, allow_network, force).await
}
