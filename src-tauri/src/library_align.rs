//! One-at-a-time guard for the library-wide align pass (scan + apply).
//!
//! One lock for both phases: an apply landing while a scan rewalks the same
//! rows — or a second scan piling onto MusicBrainz — could only fight the
//! first. The scan pays one MusicBrainz search per album (~1 req/s, paced by
//! beets' client); the apply is local writes plus Cover Art Archive fetches.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// A few hundred album searches at MusicBrainz pace lands in the tens of
/// minutes; sized like the genre recompute, with the same generosity.
const SCAN_TIMEOUT: Duration = Duration::from_secs(3600 * 2);
/// Apply hits the network for covers (two CAA requests per album) and for the
/// Last.fm genre fallback on items MusicBrainz gave no genre, paced like the
/// genre recompute — hence the same generosity.
const APPLY_TIMEOUT: Duration = Duration::from_secs(3600 * 2);

#[derive(Default)]
pub struct LibraryAlignState {
    running: Mutex<bool>,
}

impl LibraryAlignState {
    pub async fn scan(&self, app: &AppHandle) -> AppResult<Value> {
        self.run(app, "library_align_scan", json!({}), SCAN_TIMEOUT)
            .await
    }

    pub async fn apply(&self, app: &AppHandle, plan: Value) -> AppResult<Value> {
        // Boundary check only: the sidecar re-validates every field against
        // its whitelist. This just refuses a payload that isn't even a plan.
        if !plan.get("albums").map(Value::is_array).unwrap_or(false) {
            return Err(AppError::InvalidInput("not an align plan".into()));
        }
        // The user's Last.fm politeness delay, for the genre fallback.
        let prefs = preferences::load(app).await?;
        self.run(
            app,
            "library_align_apply",
            json!({
                "plan": plan,
                "fetch_pause_seconds": prefs.lastfm_fetch_delay_seconds,
            }),
            APPLY_TIMEOUT,
        )
        .await
    }

    async fn run(
        &self,
        app: &AppHandle,
        cmd: &str,
        extra: Value,
        timeout: Duration,
    ) -> AppResult<Value> {
        {
            let mut running = self.running.lock().await;
            if *running {
                return Err(AppError::InvalidInput("align already running".into()));
            }
            *running = true;
        }

        let result = request(app, cmd, extra, timeout).await;

        // Await the lock (not a Drop guard) so the flag can't stay stuck.
        *self.running.lock().await = false;
        result
    }
}

async fn request(app: &AppHandle, cmd: &str, extra: Value, timeout: Duration) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let mut params = json!({
        "beets_db": paths.beets_db.to_string_lossy(),
        "library_dir": paths.library_dir.to_string_lossy(),
    });
    if let (Some(params), Some(extra)) = (params.as_object_mut(), extra.as_object()) {
        for (key, value) in extra {
            params.insert(key.clone(), value.clone());
        }
    }
    let sidecar = app.state::<SidecarState>();
    sidecar.request(app, cmd, params, timeout).await
}
