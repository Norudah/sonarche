//! API keys, preferences and window appearance.

use tauri::AppHandle;

use crate::error::AppResult;
use crate::preferences::{self, Preferences};
use crate::settings::{self, ApiKeyStatus};
use crate::window_chrome;

#[tauri::command]
pub async fn list_api_keys(app: AppHandle) -> AppResult<Vec<ApiKeyStatus>> {
    settings::list(&app).await
}

#[tauri::command]
pub async fn set_api_key(app: AppHandle, name: String, value: String) -> AppResult<ApiKeyStatus> {
    settings::set(&app, name, value).await
}

/// Returns the stored key so the user can check it. The only command that
/// returns a secret; the keychain prompts the user itself.
#[tauri::command]
pub async fn reveal_api_key(name: String) -> AppResult<Option<String>> {
    settings::read(&name).await
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> AppResult<Preferences> {
    preferences::load(&app).await
}

#[tauri::command]
pub async fn get_home_tour_seen(app: AppHandle) -> AppResult<bool> {
    Ok(preferences::load(&app).await?.home_tour_seen)
}

#[tauri::command]
pub async fn set_home_tour_seen(app: AppHandle, seen: bool) -> AppResult<()> {
    preferences::set_home_tour_seen(&app, seen).await?;
    Ok(())
}

#[tauri::command]
pub async fn set_rate_limit_delay(
    app: AppHandle,
    key: String,
    seconds: f64,
) -> AppResult<Preferences> {
    preferences::set_rate_limit_delay(&app, &key, seconds).await
}

/// Sets the format of future downloads only; see [`super::maintenance::convert_library`].
#[tauri::command]
pub async fn set_audio_format(app: AppHandle, format: String) -> AppResult<Preferences> {
    preferences::set_audio_format(&app, &format).await
}

/// Applies the appearance setting to the native window.
#[tauri::command]
pub fn set_window_theme(window: tauri::WebviewWindow, choice: window_chrome::ThemeChoice) {
    window_chrome::follow(&window, choice);
}
