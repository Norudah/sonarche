//! One-shot library repair: remux fragmented DASH m4a files into classic MP4s.
//!
//! Downloads made before the app bundled ffmpeg kept YouTube's fragmented
//! container — fine for our own player, unreadable durations (0:00) and broken
//! seeking everywhere Apple's parsers read the classic sample tables. The
//! shell fires this once per launch after the setup gate opens; the sidecar
//! scans box headers and only rewrites files that are actually fragmented, so
//! every run after the first is a cheap no-op.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::python_env::{self, AppPaths};
use crate::sidecar::SidecarState;

/// Scan is seconds, but the first run rewrites the whole backlog; a big
/// library on a slow disk deserves better than a timeout mid-repair.
const REMUX_TIMEOUT: Duration = Duration::from_secs(60 * 60);

#[derive(Default)]
pub struct RemuxState {
    running: Mutex<()>,
}

impl RemuxState {
    pub async fn run(&self, app: &AppHandle) -> AppResult<Value> {
        let _guard = self
            .running
            .try_lock()
            .map_err(|_| AppError::InvalidInput("library repair already running".into()))?;

        let paths = AppPaths::resolve(app)?;
        python_env::ensure_ffmpeg(&paths).await?;

        let sidecar = app.state::<SidecarState>();
        sidecar
            .request(
                app,
                "library_remux",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.library_dir.to_string_lossy(),
                    "ffmpeg": paths.ffmpeg().to_string_lossy(),
                }),
                REMUX_TIMEOUT,
            )
            .await
    }
}
