//! Getting a downloaded file into the library: import, enrich, category and destination.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::error::AppResult;
use crate::python_env::{self, AppPaths};
use crate::settings;
use crate::sidecar::SidecarState;

use super::model::{ForcedAlbum, Job, JobKind};
use super::{job_log, snapshot, JobsInner};

const IMPORT_TIMEOUT: Duration = Duration::from_secs(10 * 60);

pub(super) async fn run_import(app: &AppHandle, path: &str, singleton: bool) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "import",
            json!({
                "path": path,
                "beets_config": paths.beets_config.to_string_lossy(),
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "singleton": singleton,
            }),
            IMPORT_TIMEOUT,
        )
        .await
}

const ENRICH_TIMEOUT: Duration = Duration::from_secs(5 * 60);

pub(super) async fn run_enrich(
    app: &AppHandle,
    inner: &JobsInner,
    id: &str,
    item_id: i64,
) -> AppResult<Value> {
    let (title, artist) = snapshot(inner, id)
        .await
        .map(|j| (j.title, j.artist))
        .unwrap_or((None, None));
    enrich_item(app, item_id, title, artist).await
}

/// Runs the enrich stage for a beets item. `title`/`artist` only feed the
/// text fallback; `None` reuses the item's own tags. Shared by the worker and
/// the re-enrich command.
pub async fn enrich_item(
    app: &AppHandle,
    item_id: i64,
    title: Option<String>,
    artist: Option<String>,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    python_env::ensure_fpcalc(&paths).await?;

    // The key goes from the keychain to the sidecar, never through the webview.
    let acoustid_key = match settings::read("acoustid").await {
        Ok(key) => key,
        Err(err) => {
            eprintln!("[jobs] keychain read failed, enriching without AcoustID: {err}");
            None
        }
    };

    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "enrich",
            json!({
                "item_id": item_id,
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "title": title,
                "artist": artist,
            }),
            ENRICH_TIMEOUT,
        )
        .await
}

/// Library writes only (DB session + tag writes), no network.
const LIBRARY_TIMEOUT: Duration = Duration::from_secs(60);

/// Writes the job's category on its items via `library_update`.
///
/// Runs after enrich, which rewrites tags. Never fatal: the category can be
/// set by hand.
pub(super) async fn apply_category(app: &AppHandle, id: &str, category: &str, item_ids: &[i64]) {
    if item_ids.is_empty() {
        return;
    }
    let paths = match AppPaths::resolve(app) {
        Ok(paths) => paths,
        Err(err) => {
            job_log(id, &format!("category not applied: {err}"));
            return;
        }
    };
    let updates: Vec<Value> = item_ids
        .iter()
        .map(|item_id| json!({ "id": item_id, "fields": { "grouping": category } }))
        .collect();
    let sidecar = app.state::<SidecarState>();
    let result = sidecar
        .request(
            app,
            "library_update",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "updates": updates,
            }),
            LIBRARY_TIMEOUT,
        )
        .await;
    match result {
        Ok(_) => job_log(
            id,
            &format!(
                "category '{category}' applied to {} item(s)",
                item_ids.len()
            ),
        ),
        Err(err) => job_log(id, &format!("category '{category}' not applied: {err}")),
    }
}

/// Moves the job's items onto the user-picked album, last so it wins over
/// the pipeline's filing. Never fatal: the move can be redone by hand.
pub(super) async fn apply_destination(
    app: &AppHandle,
    id: &str,
    forced: &ForcedAlbum,
    item_ids: &[i64],
    fallback_artist: Option<&str>,
) {
    if item_ids.is_empty() {
        return;
    }
    match move_to_destination(app, forced, item_ids, fallback_artist).await {
        Ok(_) => job_log(
            id,
            &format!(
                "destination « {} » holds {} arriving item(s)",
                forced.title,
                item_ids.len()
            ),
        ),
        Err(err) => job_log(id, &format!("destination not applied: {err}")),
    }
}

/// Move request shared by `apply_destination` and the later
/// "change destination" command.
pub(crate) async fn move_to_destination(
    app: &AppHandle,
    forced: &ForcedAlbum,
    item_ids: &[i64],
    fallback_artist: Option<&str>,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let (target_album_id, new_album) = match forced.album_id {
        Some(album_id) => (Some(album_id), Value::Null),
        None => {
            // The compilation default only applies to a new record without a named artist
            // and more than one track.
            let artist = forced
                .artist
                .clone()
                .or_else(|| fallback_artist.map(str::to_string))
                .unwrap_or_else(|| "Various Artists".to_string());
            (
                None,
                json!({ "album": forced.title, "albumartist": artist }),
            )
        }
    };
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "library_move_tracks",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "item_ids": item_ids,
                "target_album_id": target_album_id,
                "new_album": new_album,
                "kind": Value::Null,
                "renumber": true,
            }),
            LIBRARY_TIMEOUT,
        )
        .await
}

/// The beets items a job filed (album tracks minus dropped duplicates).
pub fn library_item_ids(job: &Job) -> Vec<i64> {
    match job.kind {
        JobKind::Album => job
            .tracks
            .iter()
            .filter(|track| track.duplicate_of.is_none())
            .filter_map(|track| track.item_id)
            .collect(),
        JobKind::Single => job.item_id.into_iter().collect(),
    }
}
