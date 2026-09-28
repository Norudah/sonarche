//! Artist image commands. See `crate::artist_images` for the model.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::artist_images::ARTIST_STEM_FALLBACK;
use crate::artwork::{self, remove_orphan};
use crate::commands::covers::{checked_cover_source, CoverCrop};
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

const MAX_NAME_CHARS: usize = 300;

const MAX_URL_CHARS: usize = 2000;

fn checked_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("empty artist name".into()));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(AppError::InvalidInput("artist name too long".into()));
    }
    Ok(name.to_string())
}

/// Every artist image as an absolute path. Filenames survive replacement, so
/// the front cache-busts with `updated_at`.
#[tauri::command]
pub async fn list_artist_images(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<Value> {
    let dir = AppPaths::resolve(&app)?.artist_images_dir();
    let images: Vec<Value> = jobs
        .list_artist_images()
        .await?
        .into_iter()
        .map(|row| {
            json!({
                "name": row.name,
                "path": dir.join(&row.filename).to_string_lossy(),
                "updated_at": row.updated_at,
            })
        })
        .collect();
    Ok(json!({ "images": images }))
}

/// Sets an artist image from a local file (optionally cropped); the replaced
/// file is deleted.
#[tauri::command]
pub async fn set_artist_image(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    name: String,
    source_path: String,
    crop: Option<CoverCrop>,
) -> AppResult<Value> {
    let name = checked_name(&name)?;
    if let Some(CoverCrop { size, .. }) = crop {
        if size == 0 {
            return Err(AppError::InvalidInput("empty crop".into()));
        }
    }
    let source = checked_cover_source(&source_path).await?;
    let dir = AppPaths::resolve(&app)?.artist_images_dir();
    tokio::fs::create_dir_all(&dir).await?;
    // Named after the artist; only other rows can collide.
    let taken: Vec<String> = jobs
        .list_artist_images()
        .await?
        .iter()
        .filter(|row| row.name != name)
        .map(|row| artwork::stem_of(&row.filename).to_string())
        .collect();
    let stem = artwork::unique_stem(&name, ARTIST_STEM_FALLBACK, &taken);

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

    let replaced = jobs
        .set_artist_image(name.clone(), filename.clone(), "local".into())
        .await?;
    remove_orphan(&dir, replaced);
    Ok(json!({ "name": name, "filename": filename }))
}

/// Removes the image; the generated avatar comes back.
#[tauri::command]
pub async fn remove_artist_image(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    name: String,
) -> AppResult<Value> {
    let name = checked_name(&name)?;
    let dir = AppPaths::resolve(&app)?.artist_images_dir();
    let removed = jobs.remove_artist_image(name).await?;
    let had_image = removed.is_some();
    remove_orphan(&dir, removed);
    Ok(json!({ "removed": had_image }))
}

/// Downloads a pasted image URL (https, size-capped, sniffed by the sidecar)
/// into a temp file, then validated like a picked file.
#[tauri::command]
pub async fn fetch_artist_image_url(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    url: String,
) -> AppResult<Value> {
    let url = url.trim().to_string();
    if !url.starts_with("https://") {
        return Err(AppError::InvalidInput(
            "only https links are accepted".into(),
        ));
    }
    if url.chars().count() > MAX_URL_CHARS {
        return Err(AppError::InvalidInput("link too long".into()));
    }
    let result = sidecar
        .request(
            &app,
            "artist_image_fetch",
            json!({ "url": url }),
            Duration::from_secs(60),
        )
        .await?;
    let path = result
        .get("path")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Sidecar("artist_image_fetch returned no path".into()))?;
    let canonical = checked_cover_source(path).await?;
    Ok(json!({
        "path": canonical.to_string_lossy(),
        "bytes": result.get("bytes").and_then(Value::as_u64).unwrap_or(0),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_is_trimmed_and_must_not_be_blank() {
        assert_eq!(checked_name("  Daft Punk ").unwrap(), "Daft Punk");
        assert!(checked_name("   ").is_err());
    }

    #[test]
    fn a_name_past_the_bound_is_refused() {
        assert!(checked_name(&"a".repeat(MAX_NAME_CHARS)).is_ok());
        assert!(checked_name(&"a".repeat(MAX_NAME_CHARS + 1)).is_err());
    }
}
