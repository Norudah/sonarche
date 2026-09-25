//! Launch-time library repairs, run once the setup gate opens: remux
//! fragmented DASH m4a files (downloaded before ffmpeg was bundled) into
//! classic MP4, sweep legacy cover archives, and re-file after template
//! changes.
//!
//! The remux is incremental: a watermark stores the highest beets item id
//! already checked, so each launch only scans newer items.

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::python_env::{self, AppPaths};
use crate::sidecar::SidecarState;

/// The first run may rewrite a large backlog.
const REMUX_TIMEOUT: Duration = Duration::from_secs(60 * 60);

const CLEANUP_TIMEOUT: Duration = Duration::from_secs(10 * 60);

const RELAYOUT_TIMEOUT: Duration = Duration::from_secs(60 * 60);

/// Marker for the current path templates. Its name is the template version:
/// renaming it makes every install re-file once.
///
/// - `library-zoned`: the `Library/` + `Unidentified/` split.
/// - `library-filed-v2`: compilations file under their album artist.
const LAYOUT_MARKER: &str = "library-filed-v2";

/// Every marker name ever used, all removed by an erase.
pub const LAYOUT_MARKERS: &[&str] = &["library-zoned", LAYOUT_MARKER];

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
        let mut report = sidecar
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

        // Only advanced on a completed pass.
        if let Some(settled) = report.get("checked_through").and_then(Value::as_i64) {
            if settled > since {
                let _ = tokio::fs::write(&watermark, settled.to_string()).await;
            }
        }

        self.cleanup_legacy_archives(app, &paths).await;
        let relayouted = self.relayout_zones(app, &paths).await;
        if let (Some(map), Some(moved)) = (report.as_object_mut(), relayouted) {
            // Tells the shell to refetch the library: paths changed.
            map.insert("relayouted".into(), json!(moved));
        }
        Ok(report)
    }

    /// Re-files the library onto the current templates (`APP_PATHS` in
    /// python_env.rs), once per [`LAYOUT_MARKER`]. beets only recomputes a path
    /// when something moves. Returns how many records moved, or None if skipped.
    async fn relayout_zones(&self, app: &AppHandle, paths: &AppPaths) -> Option<i64> {
        let marker = app.path().app_data_dir().ok()?.join(LAYOUT_MARKER);
        if tokio::fs::try_exists(&marker).await.unwrap_or(false) {
            return None;
        }

        let sidecar = app.state::<SidecarState>();
        let report = sidecar
            .request(
                app,
                "library_relayout",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                }),
                RELAYOUT_TIMEOUT,
            )
            .await
            .ok()?;
        let _ = tokio::fs::write(&marker, "done").await;
        crate::playlists_mirror::sync_after_library_change(app).await;
        let moved = report.get("albums").and_then(Value::as_i64).unwrap_or(0)
            + report.get("singles").and_then(Value::as_i64).unwrap_or(0);
        Some(moved)
    }

    /// One-time sweep of 2.x `cover-hq.*` archives. Silent on failure; retried
    /// next launch.
    async fn cleanup_legacy_archives(&self, app: &AppHandle, paths: &AppPaths) {
        let marker = match app.path().app_data_dir() {
            Ok(dir) => dir.join("cover-hq-cleaned"),
            Err(_) => return,
        };
        if tokio::fs::try_exists(&marker).await.unwrap_or(false) {
            return;
        }

        let sidecar = app.state::<SidecarState>();
        let done = sidecar
            .request(
                app,
                "cover_cleanup",
                json!({
                    "beets_db": paths.beets_db.to_string_lossy(),
                    "library_dir": paths.music_dir().to_string_lossy(),
                }),
                CLEANUP_TIMEOUT,
            )
            .await
            .is_ok();
        if done {
            let _ = tokio::fs::write(&marker, "done").await;
        }
    }
}

/// Removed by a data erase. beets ids only grow, so a surviving watermark
/// can't hide new files.
fn watermark_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("remux-checked"))
}

/// Missing or unreadable means zero: scan everything.
async fn read_watermark(path: &PathBuf) -> i64 {
    tokio::fs::read_to_string(path)
        .await
        .ok()
        .and_then(|raw| raw.trim().parse().ok())
        .unwrap_or(0)
}
