//! Environment setup, onboarding and diagnostics.

use serde_json::json;
use serde_json::value::RawValue;
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::identity;
use crate::onboarding::{self, OnboardingState};
use crate::python_env::{self, EnvStatus};
use crate::settings::{self};
use crate::sidecar::SidecarState;

use super::QUERY_TIMEOUT;

#[tauri::command]
pub async fn get_env_status(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::env_status(&app).await
}

#[tauri::command]
pub async fn setup_env(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::setup_env(&app).await
}

/// Reveals `sonarche.log` in the file manager, from a Rust-resolved path so no
/// opener capability is exposed to the webview.
#[tauri::command]
pub async fn reveal_log_file(app: AppHandle) -> AppResult<()> {
    let path = crate::logs::path(&app).ok_or_else(|| AppError::Setup("no log path".into()))?;
    tauri::async_runtime::spawn_blocking(move || tauri_plugin_opener::reveal_item_in_dir(&path))
        .await
        .map_err(|e| AppError::Setup(e.to_string()))?
        .map_err(|e| AppError::Setup(e.to_string()))
}

/// Validates an AcoustID key. `key: None` tests the stored key, looked up on
/// this side so it never crosses IPC.
#[tauri::command]
pub async fn check_acoustid_key(
    app: AppHandle,
    state: State<'_, SidecarState>,
    key: Option<String>,
) -> AppResult<Box<RawValue>> {
    let key = match key {
        Some(typed) if !typed.trim().is_empty() => typed,
        _ => settings::read("acoustid").await?.unwrap_or_default(),
    };
    state
        .read(
            &app,
            "acoustid_key_check",
            json!({ "key": key }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Checks whether each external service is answering.
#[tauri::command]
pub async fn check_services(
    app: AppHandle,
    state: State<'_, SidecarState>,
    only: Option<String>,
) -> AppResult<Box<RawValue>> {
    let identity = identity::user_agent(&app);
    state
        .read(
            &app,
            "services_check",
            json!({ "only": only, "user_agent": identity }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn get_onboarding_state(app: AppHandle) -> AppResult<OnboardingState> {
    onboarding::state(&app).await
}

#[tauri::command]
pub async fn set_onboarding_completed(
    app: AppHandle,
    completed: bool,
) -> AppResult<OnboardingState> {
    onboarding::set_completed(&app, completed).await
}
