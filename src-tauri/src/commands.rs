use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::dev_reset::{self, ResetTargets};
use crate::error::{AppError, AppResult};
use crate::genres::RecomputeGenresState;
use crate::jobs::{Job, JobKind, JobsState};
use crate::library_import::{ImportOutcome, ImportRecord, LibraryImportState};
use crate::library_scan::{self, ScanReport};
use crate::now_playing::{self, NowPlayingTrack};
use crate::onboarding::{self, OnboardingState};
use crate::player::{self, PlaybackStatus, PlayerState};
use crate::preferences::{self, Preferences};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::reenrich::ReenrichState;
use crate::settings::{self, ApiKeyStatus};
use crate::sidecar::SidecarState;
use crate::window_chrome;

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// Bound on the category a download may carry. Generous next to the taxonomy's
/// longest entry ("Video Games"); it exists so a pasted essay never reaches the
/// tag writer.
const MAX_CATEGORY_CHARS: usize = 100;

#[tauri::command]
pub async fn get_env_status(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::env_status(&app).await
}

#[tauri::command]
pub async fn setup_env(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::setup_env(&app).await
}

#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, JobsState>,
    url: String,
    kind: Option<JobKind>,
    category: Option<String>,
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    // Free text on purpose, like the metadata editor's own category field: the
    // taxonomy the UI offers is a starter set, not a fence. Only the bounds are
    // enforced, since this string ends up in a tag on every file the job writes.
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
        .enqueue(&app, url, kind.unwrap_or(JobKind::Single), category)
        .await
}

#[tauri::command]
pub async fn list_jobs(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.list().await)
}

#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, JobsState>, id: String) -> AppResult<Job> {
    state.retry(&app, &id).await
}

#[tauri::command]
pub async fn clear_job_history(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.clear_history().await)
}

/// Look at a folder the user is considering importing.
///
/// Read-only, and off the runtime: a music library is a deep tree and
/// `read_dir` is blocking.
#[tauri::command]
pub async fn scan_import_folder(
    app: AppHandle,
    state: State<'_, LibraryImportState>,
    path: String,
) -> AppResult<ScanReport> {
    let root = PathBuf::from(&path);
    library_scan::ensure_outside_library(&root, &AppPaths::resolve(&app)?.library_dir)?;

    let scanned = root.clone();
    let report = tokio::task::spawn_blocking(move || library_scan::scan(&scanned))
        .await
        .map_err(|err| AppError::Sidecar(format!("scan task panicked: {err}")))??;

    // Kept so the import that follows can be archived with the counts this
    // process measured, rather than with counts handed back by the page.
    state.remember_scan(&root, &report).await;
    Ok(report)
}

/// Copy a folder's music into the library. Takes as long as it takes; progress
/// reaches the page through the sidecar's own `library_import_progress` events.
#[tauri::command]
pub async fn start_library_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    state: State<'_, LibraryImportState>,
    folder: String,
) -> AppResult<ImportOutcome> {
    state.run(&app, &sidecar, &jobs, &folder).await
}

/// Every finished library import, newest first. The archive of the other way
/// music enters the ark.
#[tauri::command]
pub async fn list_imports(jobs: State<'_, JobsState>) -> AppResult<Vec<ImportRecord>> {
    Ok(jobs.list_imports().await)
}

#[tauri::command]
pub async fn list_api_keys() -> AppResult<Vec<ApiKeyStatus>> {
    settings::list().await
}

#[tauri::command]
pub async fn set_api_key(name: String, value: String) -> AppResult<ApiKeyStatus> {
    settings::set(name, value).await
}

#[tauri::command]
pub async fn list_library(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> AppResult<Box<RawValue>> {
    let paths = AppPaths::resolve(&app)?;
    // The read channel: the listing is what the UI blocks on, and it must not
    // wait out an album download running on the work channel.
    state
        .read(
            &app,
            "library_list",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
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
    state.run(&app, id).await
}

/// Play a library file now, replacing whatever was queued. Returns the decoded
/// duration in seconds — the engine's own reading of the file, which is what
/// the seek bar should trust.
///
/// Like every command here it runs through `off_runtime`: each one waits on the
/// audio thread, and the runtime's threads are not the ones to wait on it.
#[tauri::command]
pub async fn player_load(app: AppHandle, path: String) -> AppResult<Option<f64>> {
    player::off_runtime(app, move |player| player.load(&path)).await
}

/// Queue a file behind the playing one, for a seamless hand-over. The front
/// calls this once it knows what comes next.
#[tauri::command]
pub async fn player_enqueue(app: AppHandle, path: String) -> AppResult<()> {
    player::off_runtime(app, move |player| player.enqueue(&path)).await
}

#[tauri::command]
pub async fn player_toggle(app: AppHandle) -> AppResult<bool> {
    player::off_runtime(app, |player| player.toggle()).await
}

#[tauri::command]
pub async fn player_pause(app: AppHandle) -> AppResult<()> {
    player::off_runtime(app, |player| player.pause()).await
}

#[tauri::command]
pub async fn player_seek(app: AppHandle, seconds: f64) -> AppResult<()> {
    if !seconds.is_finite() {
        return Err(AppError::InvalidInput("seek target is not a number".into()));
    }
    player::off_runtime(app, move |player| player.seek(seconds)).await
}

/// `level` is the slider position, 0…1; the engine applies the audio taper.
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

/// Tell the OS what is playing — media keys, Control Center, the lock screen.
/// The front owns this because a track is more than the file path the engine
/// was handed.
#[tauri::command]
pub async fn now_playing_set(app: AppHandle, track: NowPlayingTrack) -> AppResult<()> {
    now_playing::set_track(&app, &track);
    Ok(())
}

/// The current playhead, for a front that just mounted and missed the events.
#[tauri::command]
pub async fn player_status(state: State<'_, PlayerState>) -> AppResult<PlaybackStatus> {
    Ok(state.status())
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> AppResult<Preferences> {
    preferences::load(&app).await
}

#[tauri::command]
pub async fn set_rate_limit_delay(
    app: AppHandle,
    key: String,
    seconds: f64,
) -> AppResult<Preferences> {
    preferences::set_rate_limit_delay(&app, &key, seconds).await
}

#[tauri::command]
pub async fn recompute_genres(
    app: AppHandle,
    state: State<'_, RecomputeGenresState>,
) -> AppResult<Value> {
    state.run(&app).await
}

/// Check an AcoustID key before it is stored, so a typo is caught while the
/// user still has the key on screen rather than on the first failed download.
/// Through the sidecar because that is where the HTTP client already lives —
/// and by then the engine step is done, so the venv is guaranteed to be there.
#[tauri::command]
pub async fn check_acoustid_key(
    app: AppHandle,
    state: State<'_, SidecarState>,
    key: String,
) -> AppResult<Box<RawValue>> {
    state
        .read(
            &app,
            "acoustid_key_check",
            json!({ "key": key }),
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

/// Dev-only: put back what the app can rebuild by itself. Never the library.
#[tauri::command]
pub async fn reset_setup_dev(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    targets: ResetTargets,
) -> AppResult<()> {
    dev_reset::reset_setup(&app, &state, &sidecar, targets).await
}

/// Dev-only: wipe the whole music library (audio files + beets DB) so bug-fix
/// scenarios restart from a clean slate. Refused outright in release builds.
#[tauri::command]
pub async fn reset_library_dev(app: AppHandle) -> AppResult<()> {
    dev_reset::reset_library(&app).await
}

/// The only tags an edit may touch. Keys are beets' own item attribute names,
/// so the whitelist doubles as the wire contract with the sidecar.
const EDITABLE_FIELDS: &[&str] = &[
    "title",
    "artist",
    "albumartist",
    "album",
    "year",
    "track",
    "tracktotal",
    "genre",
    // The category axis (context: Video Games, Film, …), beets' grouping tag.
    "grouping",
];

#[derive(Deserialize)]
pub struct TrackUpdate {
    id: i64,
    fields: HashMap<String, Value>,
}

/// Edit metadata on a batch of tracks in one sidecar round-trip. The whole
/// batch is validated before any write is attempted, so a single stray field
/// name rejects the request rather than half-applying it.
#[tauri::command]
pub async fn update_tracks(
    app: AppHandle,
    state: State<'_, SidecarState>,
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
    state
        .request(
            &app,
            "library_update",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
                "updates": wire,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn delete_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    id: i64,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "library_remove",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
                "id": id,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

/// The Appearance setting, pushed to the native frame. Thin on purpose: the
/// window is the state, so there is nothing to keep here.
#[tauri::command]
pub fn set_window_theme(window: tauri::WebviewWindow, choice: window_chrome::ThemeChoice) {
    window_chrome::follow(&window, choice);
}
