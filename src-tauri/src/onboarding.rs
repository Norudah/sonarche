//! First-run walkthrough state.

use serde::Serialize;
use tauri::AppHandle;

use crate::error::AppResult;
use crate::{preferences, settings};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub completed: bool,
    /// Whether the key exists; never the key itself.
    pub acoustid_configured: bool,
}

pub async fn state(app: &AppHandle) -> AppResult<OnboardingState> {
    let prefs = preferences::load(app).await?;
    // From the mirror, not the keychain, to avoid a password prompt at launch
    // (see `settings::configured_names`).
    let acoustid_configured = settings::configured_names(app)
        .await
        .unwrap_or_default()
        .iter()
        .any(|name| name == "acoustid");
    Ok(OnboardingState {
        completed: prefs.onboarding_completed,
        acoustid_configured,
    })
}

pub async fn set_completed(app: &AppHandle, completed: bool) -> AppResult<OnboardingState> {
    preferences::set_onboarding_completed(app, completed).await?;
    state(app).await
}
