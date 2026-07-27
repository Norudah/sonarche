//! Small persisted user preferences (a plain JSON file in app data) —
//! distinct from secrets (keychain, see `settings.rs`) and job history.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// One tunable politeness delay. Bounds live next to the rationale so the
/// front-end slider and the backend clamp can never drift apart.
pub struct RateLimit {
    pub min: f64,
    pub max: f64,
    pub default: f64,
}

/// Last.fm publishes no hard rate limit but asks for "sensible" use, and
/// lastgenre's client shares beets' embedded API key with every install.
pub const LASTFM_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 1.5,
    default: 1.0,
};

/// AcoustID documents 3 requests/second per key; an album batch fires one
/// lookup per track back to back, so it is the easiest limit to trip.
pub const ACOUSTID_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 2.0,
    default: 0.5,
};

/// Base pause between two YouTube downloads of a batch (jittered up to 2x at
/// use site). Sequential same-IP hammering is what gets clients flagged.
pub const DOWNLOAD_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 15.0,
    default: 3.0,
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(default = "default_lastfm")]
    pub lastfm_fetch_delay_seconds: f64,
    #[serde(default = "default_acoustid")]
    pub acoustid_lookup_delay_seconds: f64,
    #[serde(default = "default_download")]
    pub download_delay_seconds: f64,
    /// Whether the first-run walkthrough has been seen through to the end.
    ///
    /// Not derivable from the environment: once the venv is healthy, an
    /// environment check can no longer tell "never onboarded" from "onboarded
    /// and declined the optional steps", so the non-blocking steps (the
    /// AcoustID key above all) would be unreachable forever. Defaults to false,
    /// so an install that predates this field replays the walkthrough once —
    /// which is the returning-user path we want to exercise anyway.
    #[serde(default)]
    pub onboarding_completed: bool,
}

fn default_lastfm() -> f64 {
    LASTFM_DELAY.default
}
fn default_acoustid() -> f64 {
    ACOUSTID_DELAY.default
}
fn default_download() -> f64 {
    DOWNLOAD_DELAY.default
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            lastfm_fetch_delay_seconds: LASTFM_DELAY.default,
            acoustid_lookup_delay_seconds: ACOUSTID_DELAY.default,
            download_delay_seconds: DOWNLOAD_DELAY.default,
            onboarding_completed: false,
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

async fn save(app: &AppHandle, prefs: &Preferences) -> AppResult<()> {
    let path = store_path(app)?;
    if let Some(dir) = path.parent() {
        tokio::fs::create_dir_all(dir).await?;
    }
    tokio::fs::write(&path, serde_json::to_vec_pretty(prefs)?).await?;
    Ok(())
}

pub async fn set_onboarding_completed(app: &AppHandle, completed: bool) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    prefs.onboarding_completed = completed;
    save(app, &prefs).await?;
    Ok(prefs)
}

/// Sets one delay by its wire key. Unknown keys are rejected rather than
/// silently ignored — the IPC boundary validates, it does not guess.
pub async fn set_rate_limit_delay(
    app: &AppHandle,
    key: &str,
    seconds: f64,
) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    let (field, limit): (&mut f64, &RateLimit) = match key {
        "lastfm" => (&mut prefs.lastfm_fetch_delay_seconds, &LASTFM_DELAY),
        "acoustid" => (&mut prefs.acoustid_lookup_delay_seconds, &ACOUSTID_DELAY),
        "download" => (&mut prefs.download_delay_seconds, &DOWNLOAD_DELAY),
        other => {
            return Err(AppError::InvalidInput(format!(
                "unknown rate limit '{other}'"
            )))
        }
    };
    *field = seconds.clamp(limit.min, limit.max);
    save(app, &prefs).await?;
    Ok(prefs)
}
