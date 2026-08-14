//! One-shot library repair: remux fragmented DASH m4a files into classic MP4s.
//!
//! Downloads made before the app bundled ffmpeg kept YouTube's fragmented
//! container — fine for our own player, unreadable durations (0:00) and broken
//! seeking everywhere Apple's parsers read the classic sample tables. The
//! shell fires this once per launch after the setup gate opens.
//!
//! Incremental, not a full walk: the pass persists how far it got (the highest
//! beets item id it settled) and the next launch scans only what arrived
//! since. The old full scan opened every m4a in the library to read its box
//! headers — "cheap" in CPU, but tens of thousands of seeks on a cold spinning
//! disk, at every single launch, forever. Downloads are fixed at the source
//! nowadays; the only new files this can still catch are imports.

use std::path::PathBuf;
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

        let watermark = watermark_path(app)?;
        let since = read_watermark(&watermark).await;

        let sidecar = app.state::<SidecarState>();
        let report = sidecar
            .request(
                app,
                "library_remux",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                    "ffmpeg": paths.ffmpeg().to_string_lossy(),
                    "since_id": since,
                }),
                REMUX_TIMEOUT,
            )
            .await?;

        // Only ever forward, and only on a completed pass: a request that
        // timed out or died mid-repair returns above and leaves the watermark
        // where it was, so the next launch picks the backlog up again.
        if let Some(settled) = report.get("checked_through").and_then(Value::as_i64) {
            if settled > since {
                let _ = tokio::fs::write(&watermark, settled.to_string()).await;
            }
        }
        Ok(report)
    }
}

/// Beside the databases in app data, and on the data-erase removal list
/// (`reset::user_data_to_remove`): an erased library is a different library,
/// and its scan starts over. Item ids in beets only grow, so a surviving
/// watermark can never hide a genuinely new file.
fn watermark_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("remux-checked"))
}

/// An unreadable or absent file is watermark zero: scan everything, exactly
/// what the first launch after this feature — or after an erase — should do.
async fn read_watermark(path: &PathBuf) -> i64 {
    tokio::fs::read_to_string(path)
        .await
        .ok()
        .and_then(|raw| raw.trim().parse().ok())
        .unwrap_or(0)
}
