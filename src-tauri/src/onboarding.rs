//! First-run walkthrough state.
//!
//! Deliberately its own command surface rather than a slice of `get_preferences`:
//! the walkthrough asks two questions (has it been seen through, and is the
//! optional AcoustID key in place) that no other screen asks together, and
//! answering them here keeps the onboarding feature from reaching into the
//! settings feature for its own state.

use serde::Serialize;
use tauri::AppHandle;

use crate::error::AppResult;
use crate::{preferences, settings};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub completed: bool,
    /// The one optional step. Never the key itself — only whether it exists.
    pub acoustid_configured: bool,
}

pub async fn state(app: &AppHandle) -> AppResult<OnboardingState> {
    let prefs = preferences::load(app).await?;
    // The mirror, not the keychain. This runs on every launch, and asking the
    // keychain whether an entry exists means asking macOS for the secret, which
    // means a password dialog over the splash screen of an app the user only
    // wanted to open. See `settings::configured_names`. A probe that fails
    // still answers "not configured" here: the step stays open, which is the
    // recoverable side of the mistake.
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
