//! The image an artist wears in the interface.
//!
//! An artist is an entity nowhere else — no beets table, no folder in the
//! library, no audio tag — so their image lives entirely on our side: the file
//! under the library's `Artwork/Artists/` (a 500px square rendition, same
//! rules as a cover, named after the artist so the folder reads without the
//! app), the index row in sonarche.db (`artist_images`, keyed by the exact
//! albumartist string). The beets zone (`Music/`) stays 100% beets-clean.
//!
//! The sidecar only turns the picked file into the rendition (Pillow lives
//! there); everything else — naming, the index, orphan cleanup, following a
//! rename — happens here.

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::artwork;
use crate::commands::{checked_cover_source, CoverCrop};
use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Longest name the index will key on. beets tags are unbounded; a name past
/// this is a pasted essay, not an artist.
const MAX_NAME_CHARS: usize = 300;

/// Bound on a pasted image link. Far beyond any real URL; a longer one is a
/// data: blob or an attack, not an address.
const MAX_URL_CHARS: usize = 2000;

/// What an artist name that sanitizes to nothing files under.
pub(crate) const ARTIST_STEM_FALLBACK: &str = "Artist";

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

/// Shared with the playlist covers, which follow the same replace-then-sweep
/// discipline in their own directory.
pub(crate) fn remove_orphan(dir: &Path, filename: Option<String>) {
    if let Some(filename) = filename {
        let path = dir.join(&filename);
        if let Err(err) = std::fs::remove_file(&path) {
            eprintln!("[artist-images] could not remove {}: {err}", path.display());
        }
    }
}

/// Every artist image on record, as absolute paths the webview can draw (the
/// library root is in the asset scope). The filename is the artist's own name
/// and survives a replacement, so the front busts its cache with
/// `updated_at`.
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

/// Give an artist an image from a local file: the sidecar writes the 500px
/// square rendition (optional crop, same geometry as a cover) under the
/// artist's readable name, the index row points at it, and the file it
/// replaces goes.
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
    // The file is named after the artist — it lives in the visible `Artwork/`
    // zone, where a UUID would mean nothing. Replacing one's own image reuses
    // one's own stem; only the *other* rows can collide.
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

/// Take an artist's image away: the generated avatar comes back, the row and
/// the file both go.
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

/// Download a pasted image link into a temp file the modal then adopts like a
/// local pick — the user chose the source, the app only executes the click.
/// The sidecar does the fetch (https only, size cap, magic-byte sniff); the
/// path it hands back re-runs the same checks as any picked file.
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

/// Follow the albumartist renames a `library_update` reported: the image goes
/// with the name — the row in the index, and now the readable file on disk.
/// Best-effort on purpose — the metadata edit already succeeded, and a
/// stranded image row must not fail it after the fact.
pub async fn follow_renames(app: &AppHandle, jobs: &JobsState, update_result: &Value) {
    let Some(renames) = update_result
        .get("artist_renames")
        .and_then(Value::as_array)
    else {
        return;
    };
    let dir = match AppPaths::resolve(app) {
        Ok(paths) => paths.artist_images_dir(),
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
        if old == new {
            continue;
        }
        let rows = match jobs.list_artist_images().await {
            Ok(rows) => rows,
            Err(err) => {
                eprintln!("[artist-images] rename follow skipped: {err}");
                return;
            }
        };
        let Some(old_row) = rows.iter().find(|row| row.name == old) else {
            continue;
        };
        if rows.iter().any(|row| row.name == new) {
            // The rename merges a stray into an artist that already wears an
            // image of their own; that one wins, the stray's row and file go.
            match jobs.remove_artist_image(old.to_string()).await {
                Ok(orphan) => remove_orphan(&dir, orphan),
                Err(err) => eprintln!("[artist-images] rename {old:?} -> {new:?} failed: {err}"),
            }
            continue;
        }
        let extension = Path::new(&old_row.filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let taken: Vec<String> = rows
            .iter()
            .filter(|row| row.name != old)
            .map(|row| artwork::stem_of(&row.filename).to_string())
            .collect();
        let mut filename = format!(
            "{}.{extension}",
            artwork::unique_stem(new, ARTIST_STEM_FALLBACK, &taken)
        );
        if filename != old_row.filename {
            // File first, row second: a failed rename leaves the row pointing
            // at the file that still exists, which keeps the image working.
            if let Err(err) =
                tokio::fs::rename(dir.join(&old_row.filename), dir.join(&filename)).await
            {
                eprintln!("[artist-images] file rename for {new:?} failed, keeping name: {err}");
                filename = old_row.filename.clone();
            }
        }
        if let Err(err) = jobs
            .rename_artist_image(old.to_string(), new.to_string(), filename)
            .await
        {
            eprintln!("[artist-images] rename {old:?} -> {new:?} failed: {err}");
        }
    }
}
