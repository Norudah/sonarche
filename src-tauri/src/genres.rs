//! One-at-a-time guard for the library-wide "recompute genres" batch.
//!
//! Recompute canonicalizes existing genres offline and only hits Last.fm for
//! items with no genre at all, but it still walks the whole library: a second
//! concurrent run could only fight the first over the same rows.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Genre-less items each cost a throttled Last.fm round-trip (sidecar paces
/// itself at ~1s/item to stay polite to beets' shared API key) — a large,
/// mostly-untagged library needs real headroom here.
const RECOMPUTE_TIMEOUT: Duration = Duration::from_secs(3600 * 3);

#[derive(Default)]
pub struct RecomputeGenresState {
    running: Mutex<bool>,
}

impl RecomputeGenresState {
    pub async fn run(&self, app: &AppHandle) -> AppResult<Value> {
        {
            let mut running = self.running.lock().await;
            if *running {
                return Err(AppError::InvalidInput(
                    "genre recompute already running".into(),
                ));
            }
            *running = true;
        }

        let result = request(app).await;

        // Await the lock (not a Drop guard) so the flag can't stay stuck.
        *self.running.lock().await = false;
        result
    }
}

async fn request(app: &AppHandle) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "genres_recompute",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
            }),
            RECOMPUTE_TIMEOUT,
        )
        .await
}
