//! Album cover replacement.

use std::path::PathBuf;
use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Accepted source formats for a replacement cover.
const COVER_SOURCE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

/// Canonicalizes a user-picked image path and checks it is an existing file
/// with an allowed extension.
pub(crate) async fn checked_cover_source(path: &str) -> AppResult<PathBuf> {
    let canonical = tokio::fs::canonicalize(path)
        .await
        .map_err(|_| AppError::InvalidInput(format!("file not found: {path}")))?;
    let extension = canonical
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !COVER_SOURCE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unsupported image type: .{extension}"
        )));
    }
    let meta = tokio::fs::metadata(&canonical).await?;
    if !meta.is_file() {
        return Err(AppError::InvalidInput("not a file".into()));
    }
    Ok(canonical)
}

/// Grants the asset scope to one picked file outside the library, so the
/// webview can preview it. Returns its size.
#[tauri::command]
pub async fn allow_cover_preview(app: AppHandle, path: String) -> AppResult<Value> {
    use tauri::Manager;

    let canonical = checked_cover_source(&path).await?;
    let bytes = tokio::fs::metadata(&canonical).await?.len();
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|err| AppError::InvalidInput(format!("could not admit the file: {err}")))?;
    Ok(json!({ "path": canonical.to_string_lossy(), "bytes": bytes }))
}

/// The album's current cover as a crop source, for reframing it.
///
/// `art_path` comes from the library listing but is still checked against
/// the library before being admitted to the asset scope.
#[tauri::command]
pub async fn album_recrop_source(app: AppHandle, art_path: String) -> AppResult<Value> {
    use tauri::Manager;

    let paths = AppPaths::resolve(&app)?;
    let music_dir = tokio::fs::canonicalize(paths.music_dir())
        .await
        .unwrap_or_else(|_| paths.music_dir());
    let source = checked_cover_source(&art_path).await?;
    if !source.starts_with(&music_dir) {
        return Err(AppError::InvalidInput("cover outside the library".into()));
    }

    let bytes = tokio::fs::metadata(&source).await?.len();
    app.asset_protocol_scope()
        .allow_file(&source)
        .map_err(|err| AppError::InvalidInput(format!("could not admit the file: {err}")))?;
    Ok(json!({ "path": source.to_string_lossy(), "bytes": bytes }))
}

/// Crop square in source pixels, after EXIF orientation.
#[derive(Deserialize)]
pub struct CoverCrop {
    pub(crate) left: u32,
    pub(crate) top: u32,
    pub(crate) size: u32,
}

/// Replaces an album's cover with a local file (optionally cropped) or a Cover
/// Art Archive candidate: writes the 500px artpath, embeds it, and clears the
/// provisional-cover flag.
#[tauri::command]
pub async fn set_album_cover(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_id: i64,
    source_path: Option<String>,
    crop: Option<CoverCrop>,
    candidate_url: Option<String>,
) -> AppResult<Value> {
    if album_id <= 0 {
        return Err(AppError::InvalidInput(format!("bad album id: {album_id}")));
    }
    if source_path.is_some() == candidate_url.is_some() {
        return Err(AppError::InvalidInput(
            "exactly one of source_path / candidate_url is required".into(),
        ));
    }
    if let Some(CoverCrop { size, .. }) = crop {
        if size == 0 {
            return Err(AppError::InvalidInput("empty crop".into()));
        }
    }
    if let Some(url) = &candidate_url {
        // Only CAA URLs: the sidecar will fetch this.
        if !url.starts_with("https://coverartarchive.org/") {
            return Err(AppError::InvalidInput(
                "candidate URL outside the Cover Art Archive".into(),
            ));
        }
    }
    let source = match source_path {
        Some(path) => Some(checked_cover_source(&path).await?),
        None => None,
    };
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "cover_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_id": album_id,
                "source_path": source.map(|p| p.to_string_lossy().into_owned()),
                "image_url": candidate_url,
                "crop": crop.map(|c| json!({ "left": c.left, "top": c.top, "size": c.size })),
            }),
            // Full-size CAA uploads can be slow.
            Duration::from_secs(120),
        )
        .await
}

/// The album's Cover Art Archive images, thumbnails inlined as data URLs.
#[tauri::command]
pub async fn list_cover_candidates(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_id: i64,
) -> AppResult<Value> {
    if album_id <= 0 {
        return Err(AppError::InvalidInput(format!("bad album id: {album_id}")));
    }
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "cover_candidates",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_id": album_id,
            }),
            // The index plus up to eight thumbnails.
            Duration::from_secs(90),
        )
        .await
}
