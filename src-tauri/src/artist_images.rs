//! Artist images. Artists exist nowhere in beets, so the image is ours: a
//! 500px file under `Artwork/Artists/` named after the artist, indexed in
//! sonarche.db (`artist_images`, keyed by albumartist). The sidecar only
//! renders the file (Pillow); naming, indexing and cleanup happen here.

use std::path::Path;

use serde_json::Value;
use tauri::AppHandle;

use crate::artwork::{self, remove_orphan};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;

/// File stem for a name that sanitizes to nothing.
pub(crate) const ARTIST_STEM_FALLBACK: &str = "Artist";

/// Moves images along with the albumartist renames a `library_update`
/// reported. Best-effort: the edit already succeeded.
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
            log_line!("[artist-images] rename follow skipped: {err}");
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
                log_line!("[artist-images] rename follow skipped: {err}");
                return;
            }
        };
        let Some(old_row) = rows.iter().find(|row| row.name == old) else {
            continue;
        };
        if rows.iter().any(|row| row.name == new) {
            // The target artist already has an image: it wins.
            match jobs.remove_artist_image(old.to_string()).await {
                Ok(orphan) => remove_orphan(&dir, orphan),
                Err(err) => log_line!("[artist-images] rename {old:?} -> {new:?} failed: {err}"),
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
            // File first, so a failed rename keeps the row valid.
            if let Err(err) =
                tokio::fs::rename(dir.join(&old_row.filename), dir.join(&filename)).await
            {
                log_line!("[artist-images] file rename for {new:?} failed, keeping name: {err}");
                filename = old_row.filename.clone();
            }
        }
        if let Err(err) = jobs
            .rename_artist_image(old.to_string(), new.to_string(), filename)
            .await
        {
            log_line!("[artist-images] rename {old:?} -> {new:?} failed: {err}");
        }
    }
}
