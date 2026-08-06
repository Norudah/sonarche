//! The image an artist wears in the interface.
//!
//! An artist is an entity nowhere else — no beets table, no folder in the
//! library, no audio tag — so their image lives entirely on our side: the file
//! under app data's `artists/` directory (a 500px square rendition, same rules
//! as a cover), the index row in sonarche.db (`artist_images`, keyed by the
//! exact albumartist string). The library directory stays 100% beets-clean.
//!
//! The sidecar only turns the picked file into the rendition (Pillow lives
//! there); everything else — naming, the index, orphan cleanup, following a
//! rename — happens here.

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::commands::{checked_cover_source, CoverCrop};
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Longest name the index will key on. beets tags are unbounded; a name past
/// this is a pasted essay, not an artist.
const MAX_NAME_CHARS: usize = 300;

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

fn remove_orphan(dir: &Path, filename: Option<String>) {
    if let Some(filename) = filename {
        let path = dir.join(&filename);
        if let Err(err) = std::fs::remove_file(&path) {
            eprintln!("[artist-images] could not remove {}: {err}", path.display());
        }
    }
}

/// Every artist image on record, as absolute paths the webview can draw
/// (`$APPDATA/**` sits in the static asset scope). The filename is a fresh
/// random stem per write, so the URL changes with the picture and no cache
/// buster is needed.
#[tauri::command]
pub async fn list_artist_images(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<Value> {
    let dir = AppPaths::resolve(&app)?.artist_images_dir;
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

/// Give an artist an image from a local file: the sidecar writes the 500px
/// square rendition (optional crop, same geometry as a cover) under a fresh
/// random name, the index row points at it, and the file it replaces goes.
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
    let dir = AppPaths::resolve(&app)?.artist_images_dir;
    let stem = Uuid::new_v4().simple().to_string();

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

/// Take an artist's image away: the generated avatar comes back, the row and
/// the file both go.
#[tauri::command]
pub async fn remove_artist_image(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    name: String,
) -> AppResult<Value> {
    let name = checked_name(&name)?;
    let dir = AppPaths::resolve(&app)?.artist_images_dir;
    let removed = jobs.remove_artist_image(name).await?;
    let had_image = removed.is_some();
    remove_orphan(&dir, removed);
    Ok(json!({ "removed": had_image }))
}

/// Follow the albumartist renames a `library_update` reported: the image goes
/// with the name. Best-effort on purpose — the metadata edit already
/// succeeded, and a stranded image row must not fail it after the fact.
pub async fn follow_renames(app: &AppHandle, jobs: &JobsState, update_result: &Value) {
    let Some(renames) = update_result
        .get("artist_renames")
        .and_then(Value::as_array)
    else {
        return;
    };
    let dir = match AppPaths::resolve(app) {
        Ok(paths) => paths.artist_images_dir,
        Err(err) => {
            eprintln!("[artist-images] rename follow skipped: {err}");
            return;
        }
    };
    for rename in renames {
        let (Some(old), Some(new)) = (
            rename.get("old").and_then(Value::as_str),
            rename.get("new").and_then(Value::as_str),
        ) else {
            continue;
        };
        match jobs
            .rename_artist_image(old.to_string(), new.to_string())
            .await
        {
            Ok(orphan) => remove_orphan(&dir, orphan),
            Err(err) => eprintln!("[artist-images] rename {old:?} -> {new:?} failed: {err}"),
        }
    }
}
