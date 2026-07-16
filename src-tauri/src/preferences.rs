//! Small persisted user preferences (a plain JSON file in app data) —
//! distinct from secrets (keychain, see `settings.rs`) and job history.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::AppResult;

/// Last.fm publishes no hard rate limit but asks for "sensible" use, and
/// lastgenre's client shares beets' embedded API key with every install —
/// this caps how aggressive the genre recompute batch is allowed to be.
pub const MIN_LASTFM_DELAY_SECONDS: f64 = 0.0;
pub const MAX_LASTFM_DELAY_SECONDS: f64 = 1.5;
const DEFAULT_LASTFM_DELAY_SECONDS: f64 = 1.0;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub lastfm_fetch_delay_seconds: f64,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            lastfm_fetch_delay_seconds: DEFAULT_LASTFM_DELAY_SECONDS,
        }
    }
}

fn store_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("preferences.json"))
}

pub async fn load(app: &AppHandle) -> AppResult<Preferences> {
    let path = store_path(app)?;
    let raw = match tokio::fs::read_to_string(&path).await {
        Ok(raw) => raw,
        Err(_) => return Ok(Preferences::default()),
    };
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

pub async fn set_lastfm_fetch_delay(app: &AppHandle, seconds: f64) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    prefs.lastfm_fetch_delay_seconds =
        seconds.clamp(MIN_LASTFM_DELAY_SECONDS, MAX_LASTFM_DELAY_SECONDS);

    let path = store_path(app)?;
    if let Some(dir) = path.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    tokio::fs::write(&path, serde_json::to_vec_pretty(&prefs)?).await?;
    Ok(prefs)
}
