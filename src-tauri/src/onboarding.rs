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
    // A keychain read that fails (locked keychain, denied prompt) must not take
    // the whole walkthrough down: an unreadable key is, for this screen, the
    // same as a missing one — the step stays open and the user can re-enter it.
    let acoustid_configured = settings::read("acoustid")
        .await
        .unwrap_or(None)
        .is_some_and(|key| !key.trim().is_empty());
    Ok(OnboardingState {
        completed: prefs.onboarding_completed,
        acoustid_configured,
    })
}

pub async fn set_completed(app: &AppHandle, completed: bool) -> AppResult<OnboardingState> {
    preferences::set_onboarding_completed(app, completed).await?;
    state(app).await
}
