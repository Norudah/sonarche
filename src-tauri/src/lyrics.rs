//! One track's lyrics, on demand.
//!
//! No state and no throttle, unlike the enrich paths: this is a single lookup
//! for a single track, and `allow_network` is false unless the user has pressed
//! the button — opening the panel reads what the library already holds and
//! reaches nothing. There is no shape here that a second click could make
//! expensive.

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::identity::user_agent;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// One HTTP round-trip, plus the search fallback when the exact match misses.
const TIMEOUT: Duration = Duration::from_secs(30);

pub async fn fetch(
    app: &AppHandle,
    item_id: i64,
    allow_network: bool,
    force: bool,
) -> AppResult<Value> {
    if item_id <= 0 {
        return Err(AppError::InvalidInput("invalid track id".into()));
    }
    let paths = AppPaths::resolve(app)?;
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "lyrics_fetch",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "item_id": item_id,
                "allow_network": allow_network,
                "force": force,
                "user_agent": user_agent(app),
            }),
            TIMEOUT,
        )
        .await
}
