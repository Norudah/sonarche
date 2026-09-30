//! One-at-a-time guard for the library-wide align pass, shared by scan and
//! apply so they never overlap.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

const SCAN_TIMEOUT: Duration = Duration::from_secs(3600 * 2);
/// Covers and paced Last.fm fallbacks.
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
        // Shape check only; the sidecar validates every field.
        if !plan.get("albums").map(Value::is_array).unwrap_or(false) {
            return Err(AppError::InvalidInput("not an align plan".into()));
        }
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
        "library_dir": paths.music_dir().to_string_lossy(),
    });
    if let (Some(params), Some(extra)) = (params.as_object_mut(), extra.as_object()) {
        for (key, value) in extra {
            params.insert(key.clone(), value.clone());
        }
    }
    let sidecar = app.state::<SidecarState>();
    sidecar.request(app, cmd, params, timeout).await
}
