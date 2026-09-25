use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::convert::ConvertLibraryState;
use crate::download_undo;
use crate::error::{AppError, AppResult};
use crate::identity;
use crate::import_undo;
use crate::jobs::{ForcedAlbum, Job, JobKind, JobsState};
use crate::library_align::LibraryAlignState;
use crate::library_import::{ImportOutcome, ImportRecord, LibraryImportState};
use crate::library_move;
use crate::library_scan::{self, ScanReport};
use crate::lyrics;
use crate::now_playing::{self, NowPlayingTrack};
use crate::onboarding::{self, OnboardingState};
use crate::player;
use crate::preferences::{self, Preferences};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::reenrich::ReenrichState;
use crate::remux::RemuxState;
use crate::reset::{self, ResetTargets};
use crate::settings::{self, ApiKeyStatus};
use crate::sidecar::SidecarState;
use crate::window_chrome;

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// Bounds the free-text category, which is written to every file's tags.
const MAX_CATEGORY_CHARS: usize = 100;

/// Bounds a forced album's title and artist; soundtrack titles run long.
const MAX_ALBUM_CHARS: usize = 300;

#[tauri::command]
pub async fn get_env_status(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::env_status(&app).await
}

#[tauri::command]
pub async fn setup_env(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::setup_env(&app).await
}

/// Reveals `sonarche.log` in the file manager, from a Rust-resolved path so no
/// opener capability is exposed to the webview.
#[tauri::command]
pub async fn reveal_log_file(app: AppHandle) -> AppResult<()> {
    let path = crate::logs::path(&app).ok_or_else(|| AppError::Setup("no log path".into()))?;
    tauri::async_runtime::spawn_blocking(move || tauri_plugin_opener::reveal_item_in_dir(&path))
        .await
        .map_err(|e| AppError::Setup(e.to_string()))?
        .map_err(|e| AppError::Setup(e.to_string()))
}

#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, JobsState>,
    url: String,
    kind: Option<JobKind>,
    category: Option<String>,
    forced_album: Option<ForcedAlbum>,
    single_album: Option<bool>,
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    // Free text: the UI's taxonomy is a starter set. Only bounds are enforced.
    let category = match category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
    {
        Some(c) if c.chars().count() > MAX_CATEGORY_CHARS => {
            return Err(AppError::InvalidInput("category is too long".into()))
        }
        other => other,
    };
    // No title means no forced album, not an error.
    let forced_album = match forced_album {
        Some(forced) => {
            let title = forced.title.trim().to_string();
            let artist = forced
                .artist
                .map(|a| a.trim().to_string())
                .filter(|a| !a.is_empty());
            if forced.album_id.is_some_and(|id| id <= 0) {
                return Err(AppError::InvalidInput("invalid target album".into()));
            }
            if title.is_empty() {
                None
            } else if title.chars().count() > MAX_ALBUM_CHARS
                || artist
                    .as_ref()
                    .is_some_and(|a| a.chars().count() > MAX_ALBUM_CHARS)
            {
                return Err(AppError::InvalidInput(
                    "forced album name is too long".into(),
                ));
            } else {
                Some(ForcedAlbum {
                    title,
                    artist,
                    album_id: forced.album_id,
                })
            }
        }
        None => None,
    };
    state
        .enqueue(
            &app,
            url,
            kind.unwrap_or(JobKind::Single),
            category,
            forced_album,
            single_album.unwrap_or(true),
        )
        .await
}

#[tauri::command]
pub async fn list_jobs(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.list().await)
}

/// One page of the download archive, newest first. The limit is clamped.
#[tauri::command]
pub async fn list_jobs_page(
    state: State<'_, JobsState>,
    offset: u64,
    limit: u64,
) -> AppResult<crate::jobs_store::JobsPage> {
    state.page(offset, limit.clamp(1, 100)).await
}

/// Albums an in-flight download targets, for the library's delete guard.
#[tauri::command]
pub async fn download_target_albums(state: State<'_, JobsState>) -> AppResult<Vec<i64>> {
    Ok(state.target_albums().await)
}

#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, JobsState>, id: String) -> AppResult<Job> {
    state.retry(&app, &id).await
}

#[tauri::command]
pub async fn cancel_job(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    id: String,
) -> AppResult<Job> {
    state.cancel(&app, &sidecar, &id).await
}

#[tauri::command]
pub async fn clear_job_history(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.clear_history().await)
}

/// Scans a folder the user may import. Read-only, off the async runtime.
#[tauri::command]
pub async fn scan_import_folder(
    app: AppHandle,
    state: State<'_, LibraryImportState>,
    jobs: State<'_, JobsState>,
    path: String,
) -> AppResult<ScanReport> {
    let root = PathBuf::from(&path);
    library_scan::ensure_outside_library(&root, &AppPaths::resolve(&app)?.library_root)?;

    let scanned = root.clone();
    let mut report = tokio::task::spawn_blocking(move || library_scan::scan(&scanned))
        .await
        .map_err(|err| AppError::Sidecar(format!("scan task panicked: {err}")))??;

    report.previously_imported =
        crate::library_import::overlapping_import(&jobs.list_imports().await, &root).map(
            |record| library_scan::PreviousImport {
                cancelled: matches!(
                    record.status,
                    crate::library_import::ImportStatus::Cancelled
                ),
                folder: record.folder,
                finished_at: record.finished_at,
            },
        );

    // Remembered so the import is archived with counts measured here, not
    // values sent back by the webview.
    state.remember_scan(&root, &report).await;
    Ok(report)
}

/// Copies a folder's music into the library; progress arrives as sidecar
/// `library_import_progress` events.
#[tauri::command]
pub async fn start_library_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    state: State<'_, LibraryImportState>,
    folder: String,
    grouping: Option<String>,
    category: Option<String>,
) -> AppResult<ImportOutcome> {
    let grouping = grouping.unwrap_or_else(|| "folder".into());
    // Same rules as the download category.
    let category = match category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
    {
        Some(c) if c.chars().count() > MAX_CATEGORY_CHARS => {
            return Err(AppError::InvalidInput("category is too long".into()))
        }
        other => other,
    };
    state
        .run(
            &app,
            &sidecar,
            &jobs,
            &folder,
            &grouping,
            category.as_deref(),
        )
        .await
}

/// Every finished library import, newest first.
#[tauri::command]
pub async fn list_imports(jobs: State<'_, JobsState>) -> AppResult<Vec<ImportRecord>> {
    Ok(jobs.list_imports().await)
}

/// Signals the running import to stop; the import call resolves as cancelled.
#[tauri::command]
pub async fn cancel_library_import(state: State<'_, LibraryImportState>) -> AppResult<()> {
    state.cancel().await
}

/// What undoing this import would remove, counted from the current library.
#[tauri::command]
pub async fn preview_import_undo(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: String,
) -> AppResult<import_undo::UndoPreview> {
    import_undo::preview(&app, &sidecar, &jobs, &id).await
}

/// Removes one import's tracks, emptied albums, covers, playlist entries and
/// beets' memory of the folder.
#[tauri::command]
pub async fn undo_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    imports: State<'_, LibraryImportState>,
    id: String,
) -> AppResult<import_undo::UndoOutcome> {
    import_undo::run(&app, &sidecar, &jobs, &imports, &id).await
}

/// What undoing this download would remove, counted from the current library.
#[tauri::command]
pub async fn preview_download_undo(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: String,
) -> AppResult<download_undo::UndoPreview> {
    download_undo::preview(&app, &sidecar, &jobs, &id).await
}

/// Removes one download's tracks and what empties with them. The history row
/// stays, marked as undone.
#[tauri::command]
pub async fn undo_download(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    imports: State<'_, LibraryImportState>,
    id: String,
) -> AppResult<download_undo::UndoOutcome> {
    download_undo::run(&app, &sidecar, &jobs, &imports, &id).await
}

/// Re-files a finished download's tracks onto another album.
#[tauri::command]
pub async fn change_job_destination(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    id: String,
    forced_album: crate::jobs::ForcedAlbum,
) -> AppResult<Job> {
    jobs.change_destination(&app, &id, forced_album).await
}

#[tauri::command]
pub async fn list_api_keys(app: AppHandle) -> AppResult<Vec<ApiKeyStatus>> {
    settings::list(&app).await
}

#[tauri::command]
pub async fn set_api_key(app: AppHandle, name: String, value: String) -> AppResult<ApiKeyStatus> {
    settings::set(&app, name, value).await
}

/// Returns the stored key so the user can check it. The only command that
/// returns a secret; the keychain prompts the user itself.
#[tauri::command]
pub async fn reveal_api_key(name: String) -> AppResult<Option<String>> {
    settings::read(&name).await
}

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

/// Remuxes fragmented DASH m4a files into classic MP4. Run once per launch.
#[tauri::command]
pub async fn remux_library(app: AppHandle, state: State<'_, RemuxState>) -> AppResult<Value> {
    state.run(&app).await
}

/// Plays a library file now, replacing the queue. Returns the decoded
/// duration in seconds.
#[tauri::command]
pub async fn player_load(app: AppHandle, path: String) -> AppResult<Option<f64>> {
    player::ensure_in_library(&path, &AppPaths::resolve(&app)?.music_dir())?;
    player::off_runtime(app, move |player| player.load(&path)).await
}

/// Queues a file behind the playing one for a gapless transition.
#[tauri::command]
pub async fn player_enqueue(app: AppHandle, path: String) -> AppResult<()> {
    player::ensure_in_library(&path, &AppPaths::resolve(&app)?.music_dir())?;
    player::off_runtime(app, move |player| player.enqueue(&path)).await
}

#[tauri::command]
pub async fn player_toggle(app: AppHandle) -> AppResult<bool> {
    player::off_runtime(app, |player| player.toggle()).await
}

#[tauri::command]
pub async fn player_seek(app: AppHandle, seconds: f64) -> AppResult<()> {
    if !seconds.is_finite() {
        return Err(AppError::InvalidInput("seek target is not a number".into()));
    }
    player::off_runtime(app, move |player| player.seek(seconds)).await
}

/// `level` is the 0…1 slider position.
#[tauri::command]
pub async fn player_set_volume(app: AppHandle, level: f64) -> AppResult<()> {
    if !level.is_finite() {
        return Err(AppError::InvalidInput("volume is not a number".into()));
    }
    player::off_runtime(app, move |player| player.set_volume(level as f32)).await
}

#[tauri::command]
pub async fn player_stop(app: AppHandle) -> AppResult<()> {
    player::off_runtime(app, |player| player.stop()).await
}

/// Updates the OS media session (media keys, Control Center, lock screen).
#[tauri::command]
pub async fn now_playing_set(app: AppHandle, track: NowPlayingTrack) -> AppResult<()> {
    now_playing::set_track(&app, &track);
    Ok(())
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> AppResult<Preferences> {
    preferences::load(&app).await
}

#[tauri::command]
pub async fn get_home_tour_seen(app: AppHandle) -> AppResult<bool> {
    Ok(preferences::load(&app).await?.home_tour_seen)
}

#[tauri::command]
pub async fn set_home_tour_seen(app: AppHandle, seen: bool) -> AppResult<()> {
    preferences::set_home_tour_seen(&app, seen).await?;
    Ok(())
}

#[tauri::command]
pub async fn set_rate_limit_delay(
    app: AppHandle,
    key: String,
    seconds: f64,
) -> AppResult<Preferences> {
    preferences::set_rate_limit_delay(&app, &key, seconds).await
}

/// Sets the format of future downloads only; see [`convert_library`].
#[tauri::command]
pub async fn set_audio_format(app: AppHandle, format: String) -> AppResult<Preferences> {
    preferences::set_audio_format(&app, &format).await
}

/// Re-encodes the library into the configured format. Long-running; each
/// original is deleted once its replacement is written.
#[tauri::command]
pub async fn convert_library(
    app: AppHandle,
    state: State<'_, ConvertLibraryState>,
) -> AppResult<Value> {
    state.run(&app).await
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

/// Validates an AcoustID key. `key: None` tests the stored key, looked up on
/// this side so it never crosses IPC.
#[tauri::command]
pub async fn check_acoustid_key(
    app: AppHandle,
    state: State<'_, SidecarState>,
    key: Option<String>,
) -> AppResult<Box<RawValue>> {
    let key = match key {
        Some(typed) if !typed.trim().is_empty() => typed,
        _ => settings::read("acoustid").await?.unwrap_or_default(),
    };
    state
        .read(
            &app,
            "acoustid_key_check",
            json!({ "key": key }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Checks whether each external service is answering.
#[tauri::command]
pub async fn check_services(
    app: AppHandle,
    state: State<'_, SidecarState>,
    only: Option<String>,
) -> AppResult<Box<RawValue>> {
    let identity = identity::user_agent(&app);
    state
        .read(
            &app,
            "services_check",
            json!({ "only": only, "user_agent": identity }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn get_onboarding_state(app: AppHandle) -> AppResult<OnboardingState> {
    onboarding::state(&app).await
}

#[tauri::command]
pub async fn set_onboarding_completed(
    app: AppHandle,
    completed: bool,
) -> AppResult<OnboardingState> {
    onboarding::set_completed(&app, completed).await
}

#[tauri::command]
pub async fn get_library_location(app: AppHandle) -> AppResult<library_move::LibraryLocation> {
    library_move::location(&app)
}

/// Preflight for a library move; the move itself re-checks.
#[tauri::command]
pub async fn check_library_move(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    parent: String,
) -> AppResult<library_move::MoveCheck> {
    library_move::check(&app, &jobs, PathBuf::from(parent)).await
}

/// Moves the music to `parent`/Sonarche. Stops playback and the sidecar
/// first; refused while a download or import runs.
#[tauri::command]
pub async fn move_library(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    parent: String,
) -> AppResult<library_move::LibraryLocation> {
    library_move::perform(&app, &jobs, &sidecar, PathBuf::from(parent)).await
}

/// Erases all user data. Refused while a download or import runs.
#[tauri::command]
pub async fn erase_all_data(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::erase_data(&app, &jobs, &sidecar).await
}

/// Erases the music and its index, keeping artist images, playlist names and
/// histories. Refused while a download or import runs.
#[tauri::command]
pub async fn erase_library(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::erase_library(&app, &jobs, &sidecar).await
}

/// Removes every artist image (files and rows).
#[tauri::command]
pub async fn erase_artist_images(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<()> {
    reset::erase_artist_images(&app, &jobs).await
}

/// Removes every playlist (rows, covers, M3U8 mirror). The music stays.
#[tauri::command]
pub async fn erase_playlists(app: AppHandle, jobs: State<'_, JobsState>) -> AppResult<()> {
    reset::erase_playlists(&app, &jobs).await
}

/// Removes the Python environment and tools; the walkthrough rebuilds them.
#[tauri::command]
pub async fn reinstall_environment(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::reinstall_environment(&app, &sidecar).await
}

/// Dev-only: resets what the app can rebuild. Never the library.
#[tauri::command]
pub async fn reset_setup_dev(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    targets: ResetTargets,
) -> AppResult<()> {
    reset::reset_setup(&app, &state, &sidecar, targets).await
}

/// Dev-only: wipes the music library. Refused in release builds.
#[tauri::command]
pub async fn reset_library_dev(app: AppHandle) -> AppResult<()> {
    reset::reset_library(&app).await
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
        eprintln!("[playlists] prune of item {id} failed: {err}");
    }
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

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

/// Applies the appearance setting to the native window.
#[tauri::command]
pub fn set_window_theme(window: tauri::WebviewWindow, choice: window_chrome::ThemeChoice) {
    window_chrome::follow(&window, choice);
}
