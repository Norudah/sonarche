//! Native playback and the OS media session.

use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::now_playing::{self, NowPlayingTrack};
use crate::player;
use crate::python_env::AppPaths;

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
