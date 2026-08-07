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

use std::collections::HashMap;
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

/// Bound on a pasted image link. Far beyond any real URL; a longer one is a
/// data: blob or an attack, not an address.
const MAX_URL_CHARS: usize = 2000;

/// Ceiling on an exported file's stem. Windows paths still cap around 260
/// chars total; a stem this long already means a broken tag, not a name.
const MAX_EXPORT_STEM_CHARS: usize = 120;

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

/// An artist name as a file stem every filesystem accepts: Windows-hostile
/// characters and control bytes become underscores, trailing dots/spaces go
/// (Windows strips them silently, which would desync the name), and an
/// emptied result falls back rather than yielding an invisible file.
fn export_stem(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']);
    let capped: String = trimmed.chars().take(MAX_EXPORT_STEM_CHARS).collect();
    if capped.is_empty() {
        "Artiste".to_string()
    } else {
        capped
    }
}

/// Export filenames for the rows, artist order preserved. Collisions (two
/// names sanitizing to the same stem, case-insensitively — macOS and Windows
/// filesystems would silently merge them) get a numbered suffix.
fn export_names(rows: &[crate::jobs_store::ArtistImageRow]) -> Vec<(String, &str)> {
    let mut taken: HashMap<String, u32> = HashMap::new();
    rows.iter()
        .map(|row| {
            let stem = export_stem(&row.name);
            let extension = Path::new(&row.filename)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("jpg");
            let count = taken.entry(stem.to_lowercase()).or_insert(0);
            *count += 1;
            let file = if *count == 1 {
                format!("{stem}.{extension}")
            } else {
                format!("{stem} ({count}).{extension}")
            };
            (file, row.filename.as_str())
        })
        .collect()
}

/// Copy every artist image into its own folder inside the chosen directory,
/// named by artist — the internal files carry technical names that mean
/// nothing without the index. A folder of its own, so the export never
/// scatters files into whatever the user pointed at.
#[tauri::command]
pub async fn export_artist_images(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    dest: String,
    folder_name: String,
) -> AppResult<Value> {
    let folder_name = folder_name.trim();
    if folder_name.is_empty()
        || folder_name.starts_with('.')
        || folder_name.contains(['/', '\\'])
        || folder_name.chars().count() > MAX_EXPORT_STEM_CHARS
    {
        return Err(AppError::InvalidInput("bad export folder name".into()));
    }
    let dest = tokio::fs::canonicalize(&dest)
        .await
        .map_err(|_| AppError::InvalidInput(format!("folder not found: {dest}")))?;
    if !tokio::fs::metadata(&dest).await?.is_dir() {
        return Err(AppError::InvalidInput("not a folder".into()));
    }

    let rows = jobs.list_artist_images().await?;
    let images_dir = AppPaths::resolve(&app)?.artist_images_dir;
    let target = dest.join(export_stem(folder_name));
    tokio::fs::create_dir_all(&target).await?;

    let mut exported: u64 = 0;
    let mut missing: u64 = 0;
    for (out_name, filename) in export_names(&rows) {
        match tokio::fs::copy(images_dir.join(filename), target.join(&out_name)).await {
            Ok(_) => exported += 1,
            Err(err) => {
                missing += 1;
                eprintln!("[artist-images] export skipped {filename}: {err}");
            }
        }
    }
    Ok(json!({
        "exported": exported,
        "missing": missing,
        "folder": target.to_string_lossy(),
    }))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs_store::ArtistImageRow;

    fn row(name: &str, filename: &str) -> ArtistImageRow {
        ArtistImageRow {
            name: name.to_string(),
            filename: filename.to_string(),
            updated_at: 0,
        }
    }

    #[test]
    fn hostile_characters_become_underscores() {
        assert_eq!(export_stem("AC/DC"), "AC_DC");
        assert_eq!(export_stem("What? \"Why\" <Now>"), "What_ _Why_ _Now_");
    }

    /// Windows silently strips trailing dots and spaces, which would desync
    /// the visible name from what was written.
    #[test]
    fn trailing_dots_and_spaces_are_trimmed() {
        assert_eq!(export_stem("N.W.A."), "N.W.A");
        assert_eq!(export_stem("  Moby  "), "Moby");
    }

    #[test]
    fn an_emptied_name_falls_back_rather_than_vanishing() {
        assert_eq!(export_stem("..."), "Artiste");
        assert_eq!(export_stem(""), "Artiste");
    }

    /// macOS and Windows filesystems are case-insensitive: "IAM" and "iam"
    /// would silently overwrite each other without the numbering.
    #[test]
    fn colliding_stems_get_numbered() {
        let rows = [
            row("AC/DC", "a.jpg"),
            row("AC:DC", "b.png"),
            row("IAM", "c.jpg"),
            row("iam", "d.jpg"),
        ];
        let names: Vec<String> = export_names(&rows)
            .into_iter()
            .map(|(file, _)| file)
            .collect();
        assert_eq!(
            names,
            vec!["AC_DC.jpg", "AC_DC (2).png", "IAM.jpg", "iam (2).jpg"]
        );
    }

    #[test]
    fn the_extension_follows_each_source_file() {
        let rows = [row("Daft Punk", "abc123.png")];
        assert_eq!(export_names(&rows)[0].0, "Daft Punk.png");
    }
}
