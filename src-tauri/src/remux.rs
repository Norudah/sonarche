//! One-shot library repair: remux fragmented DASH m4a files into classic MP4s.
//!
//! Downloads made before the app bundled ffmpeg kept the fragmented
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

/// One `listdir` per album folder — minutes would already be generous.
const CLEANUP_TIMEOUT: Duration = Duration::from_secs(10 * 60);

/// One rename per file on its own volume; an hour covers a huge library on a
/// network share without letting a wedged pass hold the slot forever.
const RELAYOUT_TIMEOUT: Duration = Duration::from_secs(60 * 60);

/// The file that says the library already sits where the current templates put
/// it. **Its name is the version of those templates**: change a path template
/// and this name changes with it, which is the whole mechanism — every install
/// that has not seen the new name re-files itself once, on the next launch, and
/// never again.
///
/// - `library-zoned` — the `Library/` + `Unidentified/` split.
/// - `library-filed-v2` — compilations left `Compilations/` and file under
///   their album artist like every other record.
const LAYOUT_MARKER: &str = "library-filed-v2";

/// Every name [`LAYOUT_MARKER`] has ever had. The erase removes all of them: a
/// stale marker from a library that no longer exists is debt, whichever
/// generation wrote it.
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

        // Only ever forward, and only on a completed pass: a request that
        // timed out or died mid-repair returns above and leaves the watermark
        // where it was, so the next launch picks the backlog up again.
        if let Some(settled) = report.get("checked_through").and_then(Value::as_i64) {
            if settled > since {
                let _ = tokio::fs::write(&watermark, settled.to_string()).await;
            }
        }

        self.cleanup_legacy_archives(app, &paths).await;
        let relayouted = self.relayout_zones(app, &paths).await;
        if let (Some(map), Some(moved)) = (report.as_object_mut(), relayouted) {
            // Surfaced on the repair report so the shell knows to refetch the
            // library — every artUrl and path just changed under it.
            map.insert("relayouted".into(), json!(moved));
        }
        Ok(report)
    }

    /// The one-time re-file of the library onto the current path templates (see
    /// `APP_PATHS` in python_env.rs). Same launch slot and same marker pattern
    /// as the archive sweep: debt left by older versions whose templates filed
    /// music somewhere the app no longer points at. Returns how many records
    /// moved, or None when the pass did not run.
    ///
    /// beets recomputes a destination only when something moves, so a template
    /// change reaches nothing already on disk — the pass is what makes it
    /// retroactive, and [`LAYOUT_MARKER`] is what makes it happen once.
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
        // The M3U mirror renders absolute paths; every one of them just moved.
        crate::playlists_mirror::sync_after_library_change(app).await;
        let moved = report.get("albums").and_then(Value::as_i64).unwrap_or(0)
            + report.get("singles").and_then(Value::as_i64).unwrap_or(0);
        Some(moved)
    }

    /// The one-time sweep of the `cover-hq.*` archives 2.x kept beside every
    /// cover. Rides the same launch slot as the remux pass because it is the
    /// same kind of debt — files older versions left that no current write
    /// path maintains. Failure is silent and unmarked: the next launch simply
    /// tries again.
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
