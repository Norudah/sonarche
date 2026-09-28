//! Playlist commands. Validation lives in `db::playlists`.

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::artwork::{self, remove_orphan};
use crate::commands::covers::{checked_cover_source, CoverCrop};
use crate::db::playlists::{PlaylistRow, PLAYLIST_STEM_FALLBACK};
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::playlists_mirror;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// The wire shape: the cover as an absolute path the webview can load.
fn playlist_json(row: &PlaylistRow, covers_dir: &Path) -> Value {
    json!({
        "id": row.id,
        "name": row.name,
        "kind": row.kind,
        "cover_path": row.cover.as_ref().map(|f| covers_dir.join(f).to_string_lossy().into_owned()),
        "marker": row.marker,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "item_ids": row.item_ids,
    })
}

#[tauri::command]
pub async fn list_playlists(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<Value> {
    let covers_dir = AppPaths::resolve(&app)?.playlist_covers_dir();
    let rows = jobs.list_playlists().await?;
    Ok(json!({
        "playlists": rows.iter().map(|row| playlist_json(row, &covers_dir)).collect::<Vec<_>>()
    }))
}

#[tauri::command]
pub async fn create_playlist(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    name: String,
) -> AppResult<Value> {
    let covers_dir = AppPaths::resolve(&app)?.playlist_covers_dir();
    let row = jobs.create_playlist(name).await?;
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "playlist": playlist_json(&row, &covers_dir) }))
}

#[tauri::command]
pub async fn rename_playlist(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
    name: String,
) -> AppResult<Value> {
    let rows = jobs.list_playlists().await?;
    jobs.rename_playlist(id, name.clone()).await?;
    // The cover file is named after the playlist. Best-effort: the row is only
    // updated once the file has moved.
    if let Some(cover) = rows
        .iter()
        .find(|row| row.id == id)
        .and_then(|row| row.cover.clone())
    {
        let dir = AppPaths::resolve(&app)?.playlist_covers_dir();
        let extension = std::path::Path::new(&cover)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let taken: Vec<String> = rows
            .iter()
            .filter(|row| row.id != id)
            .filter_map(|row| row.cover.as_deref())
            .map(|file| artwork::stem_of(file).to_string())
            .collect();
        let filename = format!(
            "{}.{extension}",
            artwork::unique_stem(name.trim(), PLAYLIST_STEM_FALLBACK, &taken)
        );
        if filename != cover {
            match tokio::fs::rename(dir.join(&cover), dir.join(&filename)).await {
                Ok(()) => {
                    if let Err(err) = jobs.update_playlist_cover_filename(id, filename).await {
                        log_line!("[playlists] cover row not repointed: {err}");
                    }
                }
                Err(err) => log_line!("[playlists] cover rename failed, keeping name: {err}"),
            }
        }
    }
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn delete_playlist(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let orphan = jobs.delete_playlist(id).await?;
    remove_orphan(&AppPaths::resolve(&app)?.playlist_covers_dir(), orphan);
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "ok": true }))
}

/// Sets a playlist's tile: the sidecar writes the 500px rendition under
/// `Artwork/Playlists/`, the row points at it, the old file is deleted.
#[tauri::command]
pub async fn set_playlist_cover(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    id: i64,
    source_path: String,
    crop: Option<CoverCrop>,
) -> AppResult<Value> {
    if let Some(CoverCrop { size, .. }) = crop {
        if size == 0 {
            return Err(AppError::InvalidInput("empty crop".into()));
        }
    }
    let source = checked_cover_source(&source_path).await?;
    let dir = AppPaths::resolve(&app)?.playlist_covers_dir();
    tokio::fs::create_dir_all(&dir).await?;
    let rows = jobs.list_playlists().await?;
    let Some(row) = rows.iter().find(|row| row.id == id) else {
        return Err(AppError::InvalidInput("no such playlist".into()));
    };
    let taken: Vec<String> = rows
        .iter()
        .filter(|other| other.id != id)
        .filter_map(|other| other.cover.as_deref())
        .map(|file| artwork::stem_of(file).to_string())
        .collect();
    let stem = artwork::unique_stem(&row.name, PLAYLIST_STEM_FALLBACK, &taken);

    let result = sidecar
        .request(
            &app,
            "artist_image_set",
            json!({
                "source_path": source.to_string_lossy(),
                "dest_dir": dir.to_string_lossy(),
                "stem": stem,
                "crop": crop.map(|c| json!({ "left": c.left, "top": c.top, "size": c.size })),
            }),
            Duration::from_secs(60),
        )
        .await?;
    let filename = result
        .get("filename")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Sidecar("artist_image_set returned no filename".into()))?
        .to_string();

    let replaced = jobs.set_playlist_cover(id, filename.clone()).await?;
    remove_orphan(&dir, replaced);
    Ok(json!({ "id": id, "filename": filename }))
}

#[tauri::command]
pub async fn remove_playlist_cover(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let removed = jobs.remove_playlist_cover(id).await?;
    let had_cover = removed.is_some();
    remove_orphan(&AppPaths::resolve(&app)?.playlist_covers_dir(), removed);
    Ok(json!({ "removed": had_cover }))
}

#[tauri::command]
pub async fn set_playlist_marker(
    jobs: State<'_, JobsState>,
    id: i64,
    marker: String,
) -> AppResult<Value> {
    jobs.set_playlist_marker(id, marker).await?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn add_playlist_tracks(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
    item_ids: Vec<i64>,
) -> AppResult<Value> {
    let (added, skipped) = jobs.add_playlist_tracks(id, item_ids).await?;
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "added": added, "skipped": skipped }))
}

#[tauri::command]
pub async fn remove_playlist_tracks(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
    positions: Vec<u32>,
) -> AppResult<Value> {
    let removed = jobs.remove_playlist_tracks(id, positions).await?;
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "removed": removed }))
}

#[tauri::command]
pub async fn move_playlist_track(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: i64,
    from: u32,
    to: u32,
) -> AppResult<Value> {
    jobs.move_playlist_track(id, from, to).await?;
    playlists_mirror::sync(&app, &jobs).await;
    Ok(json!({ "ok": true }))
}
