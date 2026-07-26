use std::collections::HashMap;
use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::genres::RecomputeGenresState;
use crate::jobs::{Job, JobKind, JobsState};
use crate::now_playing::{NowPlayingState, NowPlayingTrack};
use crate::player::{PlaybackStatus, PlayerState};
use crate::preferences::{self, Preferences};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::reenrich::ReenrichState;
use crate::settings::{self, ApiKeyStatus};
use crate::sidecar::SidecarState;

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

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
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    state
        .enqueue(&app, url, kind.unwrap_or(JobKind::Single))
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
#[tauri::command]
pub async fn player_load(state: State<'_, PlayerState>, path: String) -> AppResult<Option<f64>> {
    state.load(&path)
}

/// Queue a file behind the playing one, for a seamless hand-over. The front
/// calls this once it knows what comes next.
#[tauri::command]
pub async fn player_enqueue(state: State<'_, PlayerState>, path: String) -> AppResult<()> {
    state.enqueue(&path)
}

#[tauri::command]
pub async fn player_toggle(state: State<'_, PlayerState>) -> AppResult<bool> {
    state.toggle()
}

#[tauri::command]
pub async fn player_pause(state: State<'_, PlayerState>) -> AppResult<()> {
    state.pause()
}

#[tauri::command]
pub async fn player_seek(state: State<'_, PlayerState>, seconds: f64) -> AppResult<()> {
    if !seconds.is_finite() {
        return Err(AppError::InvalidInput("seek target is not a number".into()));
    }
    state.seek(seconds)
}

/// `level` is the slider position, 0…1; the engine applies the audio taper.
#[tauri::command]
pub async fn player_set_volume(state: State<'_, PlayerState>, level: f64) -> AppResult<()> {
    if !level.is_finite() {
        return Err(AppError::InvalidInput("volume is not a number".into()));
    }
    state.set_volume(level as f32)
}

#[tauri::command]
pub async fn player_stop(state: State<'_, PlayerState>) -> AppResult<()> {
    state.stop()
}

/// Tell the OS what is playing — media keys, Control Center, the lock screen.
/// The front owns this because a track is more than the file path the engine
/// was handed.
#[tauri::command]
pub async fn now_playing_set(
    app: AppHandle,
    state: State<'_, NowPlayingState>,
    track: NowPlayingTrack,
) -> AppResult<()> {
    state.set_track(&app, &track)
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

/// Dev-only: wipe the whole music library (audio files + beets DB) so bug-fix
/// scenarios restart from a clean slate. Refused outright in release builds.
#[tauri::command]
pub async fn reset_library_dev(app: AppHandle) -> AppResult<()> {
    if !cfg!(debug_assertions) {
        return Err(AppError::InvalidInput(
            "library reset is only available in dev builds".into(),
        ));
    }
    let paths = AppPaths::resolve(&app)?;
    if tokio::fs::try_exists(&paths.library_dir)
        .await
        .unwrap_or(false)
    {
        tokio::fs::remove_dir_all(&paths.library_dir).await?;
    }
    tokio::fs::create_dir_all(&paths.library_dir).await?;
    let _ = tokio::fs::remove_file(&paths.beets_db).await;
    eprintln!("[dev] library reset: files and beets DB wiped");
    Ok(())
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
