//! Filing: moving tracks, album kinds, genre placements, accepted checks, alignment.

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::library_align::LibraryAlignState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

use super::QUERY_TIMEOUT;

const ALBUM_KINDS: &[&str] = &["album", "collection"];

#[derive(Deserialize)]
pub struct NewAlbum {
    album: String,
    albumartist: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveSpec {
    /// Numbering order when `renumber` is on.
    item_ids: Vec<i64>,
    target_album_id: Option<i64>,
    new_album: Option<NewAlbum>,
    kind: Option<String>,
    #[serde(default)]
    renumber: bool,
}

/// Moves tracks onto an existing album (`target_album_id`) or a new one
/// (`new_album`). `kind` optionally sets the target's kind; `renumber` numbers
/// the arrivals after the target's tracks.
#[tauri::command]
pub async fn move_tracks(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    spec: MoveSpec,
) -> AppResult<Value> {
    if spec.item_ids.is_empty() {
        return Err(AppError::InvalidInput("no tracks to move".into()));
    }
    if spec.target_album_id.is_some() == spec.new_album.is_some() {
        return Err(AppError::InvalidInput(
            "need exactly one of target_album_id and new_album".into(),
        ));
    }
    let new_album = spec
        .new_album
        .map(|target| {
            let album = target.album.trim().to_string();
            let albumartist = target.albumartist.trim().to_string();
            if album.is_empty() || albumartist.is_empty() {
                return Err(AppError::InvalidInput(
                    "a new album needs a title and an artist".into(),
                ));
            }
            Ok(json!({ "album": album, "albumartist": albumartist }))
        })
        .transpose()?;
    if let Some(kind) = spec.kind.as_deref() {
        if !ALBUM_KINDS.contains(&kind) {
            return Err(AppError::InvalidInput(format!(
                "unknown album kind: {kind}"
            )));
        }
    }

    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_move_tracks",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "item_ids": spec.item_ids,
                "target_album_id": spec.target_album_id,
                "new_album": new_album,
                "kind": spec.kind,
                "renumber": spec.renumber,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

/// Sets albums as releases or collections. Takes several ids because one UI
/// card can span several album rows.
#[tauri::command]
pub async fn set_album_kind(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_ids: Vec<i64>,
    kind: String,
) -> AppResult<Value> {
    if !ALBUM_KINDS.contains(&kind.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unknown album kind: {kind}"
        )));
    }
    if album_ids.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "album_kind_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_ids": album_ids,
                "kind": kind,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

/// The browse families' display labels, also validated by the sidecar.
const FAMILY_LABELS: &[&str] = &[
    "Metal",
    "Rock",
    "Pop",
    "Electronic",
    "Hip-Hop",
    "R&B, Soul & Funk",
    "Jazz",
    "Blues",
    "Folk & Country",
    "Classical",
    "Reggae",
    "Latin",
    "World",
];

/// Files a genre under a family, or restores the base tree (`None`). No
/// track is modified.
#[tauri::command]
pub async fn set_genre_family(
    app: AppHandle,
    state: State<'_, SidecarState>,
    genre: String,
    family: Option<String>,
) -> AppResult<Value> {
    if genre.trim().is_empty() {
        return Err(AppError::InvalidInput("empty genre".into()));
    }
    if let Some(label) = family.as_deref() {
        if !FAMILY_LABELS.contains(&label) {
            return Err(AppError::InvalidInput(format!("unknown family: {label}")));
        }
    }
    state
        .request(
            &app,
            "genre_family_set",
            json!({ "genre": genre, "family": family }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Every user genre placement.
#[tauri::command]
pub async fn list_genre_overrides(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> AppResult<Value> {
    state
        .request(&app, "genre_overrides_list", json!({}), QUERY_TIMEOUT)
        .await
}

/// Checks that may be accepted, per scope (see `accepted.py`). The sidecar
/// validates them too.
const TRACK_CHECKS: &[&str] = &["year", "track", "genre", "duplicates"];

const ALBUM_CHECKS: &[&str] = &["artwork"];

/// Accepts a check as intended, or reverts that.
#[tauri::command]
pub async fn set_check_accepted(
    app: AppHandle,
    state: State<'_, SidecarState>,
    scope: String,
    ids: Vec<i64>,
    check: String,
    accepted: bool,
) -> AppResult<Value> {
    let valid = match scope.as_str() {
        "track" => TRACK_CHECKS,
        "album" => ALBUM_CHECKS,
        other => return Err(AppError::InvalidInput(format!("unknown scope: {other}"))),
    };
    if !valid.contains(&check.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unknown {scope} check: {check}"
        )));
    }
    if ids.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "accepted_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "scope": scope,
                "ids": ids,
                "check": check,
                "accepted": accepted,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Builds the MusicBrainz fill plan for albums without an id. Writes nothing.
#[tauri::command]
pub async fn library_align_scan(
    app: AppHandle,
    state: State<'_, LibraryAlignState>,
) -> AppResult<Value> {
    state.scan(&app).await
}

/// Applies a scan plan; the sidecar re-checks every guard at write time.
#[tauri::command]
pub async fn library_align_apply(
    app: AppHandle,
    state: State<'_, LibraryAlignState>,
    plan: Value,
) -> AppResult<Value> {
    let result = state.apply(&app, plan).await?;
    crate::playlists_mirror::sync_after_library_change(&app).await;
    Ok(result)
}
