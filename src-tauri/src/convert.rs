//! One-at-a-time guard for the library-wide audio conversion: concurrent runs
//! would fight over the same files. The flag is reset by awaiting the lock,
//! not in a Drop guard, so a failed request can't leave it stuck.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::sidecar::SidecarState;

/// Only a guard against a wedged ffmpeg.
const CONVERT_TIMEOUT: Duration = Duration::from_secs(3600 * 6);

#[derive(Default)]
pub struct ConvertLibraryState {
    running: Mutex<bool>,
}

impl ConvertLibraryState {
    pub async fn run(&self, app: &AppHandle) -> AppResult<Value> {
        {
            let mut running = self.running.lock().await;
            if *running {
                return Err(AppError::InvalidInput(
                    "a conversion is already running".into(),
                ));
            }
            *running = true;
        }

        let result = request(app).await;

        *self.running.lock().await = false;
        result
    }
}

async fn request(app: &AppHandle) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    // A library may be converted before any download installed ffmpeg.
    python_env::ensure_ffmpeg(&paths).await?;
    let prefs = preferences::load(app).await?;
    let sidecar = app.state::<SidecarState>();
    let report = sidecar
        .request(
            app,
            "library_convert",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "ffmpeg": paths.ffmpeg().to_string_lossy(),
                "audio_format": prefs.audio_format,
            }),
            CONVERT_TIMEOUT,
        )
        .await?;
    // Every extension changed.
    crate::playlists_mirror::sync_after_library_change(app).await;
    Ok(report)
}
