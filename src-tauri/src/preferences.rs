//! User preferences (a JSON file in app data). Secrets live in the keychain
//! (`settings.rs`).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// A politeness delay; bounds shared by the front slider and the backend clamp.
pub struct RateLimit {
    pub min: f64,
    pub max: f64,
    pub default: f64,
}

/// No published limit, but lastgenre uses beets' shared API key.
pub const LASTFM_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 1.5,
    default: 1.0,
};

/// AcoustID allows 3 req/s per key. One second matches the floor the
/// settings screen recommends for every service.
pub const ACOUSTID_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 2.0,
    default: 1.0,
};

/// Formats the app can produce, mirroring `sidecar/audio_format.py`; used to
/// validate IPC input. `m4a` (the default) is the stream as received; `mp3`
/// is a real re-encode for devices that need it.
pub const AUDIO_FORMATS: &[&str] = &["m4a", "mp3"];

pub const DEFAULT_AUDIO_FORMAT: &str = "m4a";

/// Pause between downloads, jittered up to 2x. Higher than the others: this
/// is the limit the app has actually been throttled on.
pub const DOWNLOAD_DELAY: RateLimit = RateLimit {
    min: 0.0,
    max: 15.0,
    default: 3.0,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    #[serde(default = "default_lastfm")]
    pub lastfm_fetch_delay_seconds: f64,
    #[serde(default = "default_acoustid")]
    pub acoustid_lookup_delay_seconds: f64,
    #[serde(default = "default_download")]
    pub download_delay_seconds: f64,
    /// Whether the first-run walkthrough was completed. Can't be derived from
    /// the environment once the venv works, or skipped optional steps (the
    /// AcoustID key) would be unreachable.
    #[serde(default)]
    pub onboarding_completed: bool,
    /// Whether the home tour was shown. On disk rather than in localStorage,
    /// which an ad-hoc-signed bundle may lose across updates.
    #[serde(default)]
    pub home_tour_seen: bool,
    /// File extension, also the wire value. Unknown values fall back to the
    /// default on load.
    #[serde(default = "default_audio_format")]
    pub audio_format: String,
    /// `None` means the default location, which follows the platform rather
    /// than a path frozen at first launch.
    #[serde(default)]
    pub library_dir: Option<String>,
    /// Names of API keys stored in the keychain, never the secrets.
    ///
    /// macOS can only answer "does this entry exist" by returning the secret,
    /// which triggers a password prompt; this mirror avoids it at launch (see
    /// `onboarding::state`). `None` means never mirrored: the keychain is probed
    /// once and the answer stored.
    #[serde(default)]
    pub api_keys_configured: Option<Vec<String>>,
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
fn default_audio_format() -> String {
    DEFAULT_AUDIO_FORMAT.to_string()
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            lastfm_fetch_delay_seconds: LASTFM_DELAY.default,
            acoustid_lookup_delay_seconds: ACOUSTID_DELAY.default,
            download_delay_seconds: DOWNLOAD_DELAY.default,
            audio_format: default_audio_format(),
            onboarding_completed: false,
            home_tour_seen: false,
            library_dir: None,
            api_keys_configured: None,
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
    let mut prefs: Preferences = serde_json::from_str(&raw).unwrap_or_default();
    // API delays are fixed: the keys are shared by every install, so one user
    // lowering them could get everyone throttled. Stored values are reset.
    prefs.lastfm_fetch_delay_seconds = LASTFM_DELAY.default;
    prefs.acoustid_lookup_delay_seconds = ACOUSTID_DELAY.default;
    if !AUDIO_FORMATS.contains(&prefs.audio_format.as_str()) {
        prefs.audio_format = default_audio_format();
    }
    Ok(prefs)
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

pub async fn set_home_tour_seen(app: &AppHandle, seen: bool) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    prefs.home_tour_seen = seen;
    save(app, &prefs).await?;
    Ok(prefs)
}

/// `None` restores the default location.
pub async fn set_library_dir(app: &AppHandle, dir: Option<PathBuf>) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    prefs.library_dir = dir.map(|path| path.display().to_string());
    save(app, &prefs).await?;
    Ok(prefs)
}

/// Rejects formats the sidecar can't encode. Affects future downloads only.
pub async fn set_audio_format(app: &AppHandle, format: &str) -> AppResult<Preferences> {
    if !AUDIO_FORMATS.contains(&format) {
        return Err(AppError::InvalidInput(format!(
            "unknown audio format '{format}'"
        )));
    }
    let mut prefs = load(app).await?;
    prefs.audio_format = format.to_string();
    save(app, &prefs).await?;
    Ok(prefs)
}

/// Called by `settings` after every keychain write.
pub async fn set_api_keys_configured(
    app: &AppHandle,
    names: Vec<String>,
) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    prefs.api_keys_configured = Some(names);
    save(app, &prefs).await?;
    Ok(prefs)
}

/// Sets one delay by wire key. Unknown keys are rejected; the API delays are
/// fixed (see `load`).
pub async fn set_rate_limit_delay(
    app: &AppHandle,
    key: &str,
    seconds: f64,
) -> AppResult<Preferences> {
    let mut prefs = load(app).await?;
    let (field, limit): (&mut f64, &RateLimit) = match key {
        "download" => (&mut prefs.download_delay_seconds, &DOWNLOAD_DELAY),
        "lastfm" | "acoustid" => {
            return Err(AppError::InvalidInput(format!(
                "rate limit '{key}' is fixed"
            )))
        }
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
