//! One-at-a-time guard for the library-wide audio conversion.
//!
//! The pass re-encodes every file that is not already in the chosen format, so
//! two concurrent runs would fight over the same tracks — and, worse, over the
//! same working files beside them. The guard is the same shape as the genre
//! recompute's, for the same reason and with the same escape hatch: the flag is
//! cleared by awaiting the lock rather than by a Drop guard, so a request that
//! dies cannot leave the app permanently refusing to convert.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::sidecar::SidecarState;

/// Seconds of CPU per track, over a library that can hold thousands. Six hours
/// is not an estimate of how long this takes — it is the point past which a
/// wedged ffmpeg has to be admitted rather than waited on.
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
    // The encoder itself. Laid down on demand exactly like the download path
    // does, so a library converted before any download ever ran still finds it.
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
    // Every converted track changed its extension, and the M3U mirror renders
    // absolute paths — left alone, every playlist file would point at audio
    // that no longer exists.
    crate::playlists_mirror::sync_after_library_change(app).await;
    Ok(report)
}
