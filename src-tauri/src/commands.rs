use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::genres::RecomputeGenresState;
use crate::jobs::{Job, JobKind, JobsState};
use crate::preferences::{self, Preferences};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::reenrich::ReenrichState;
use crate::settings::{self, ApiKeyStatus};
use crate::sidecar::SidecarState;

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

#[tauri::command]
pub async fn get_env_status(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::env_status(&app).await
}

#[tauri::command]
pub async fn setup_env(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::setup_env(&app).await
}

#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, JobsState>,
    url: String,
    kind: Option<JobKind>,
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    state
        .enqueue(&app, url, kind.unwrap_or(JobKind::Single))
        .await
}

#[tauri::command]
pub async fn list_jobs(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.list().await)
}

#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, JobsState>, id: String) -> AppResult<Job> {
    state.retry(&app, &id).await
}

#[tauri::command]
pub async fn clear_job_history(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.clear_history().await)
}

#[tauri::command]
pub async fn list_api_keys() -> AppResult<Vec<ApiKeyStatus>> {
    settings::list().await
}

#[tauri::command]
pub async fn set_api_key(name: String, value: String) -> AppResult<ApiKeyStatus> {
    settings::set(name, value).await
}

#[tauri::command]
pub async fn list_library(app: AppHandle, state: State<'_, SidecarState>) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "library_list",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
            }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn reenrich_track(
    app: AppHandle,
    state: State<'_, ReenrichState>,
    id: i64,
) -> AppResult<Value> {
    state.run(&app, id).await
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> AppResult<Preferences> {
    preferences::load(&app).await
}

#[tauri::command]
pub async fn set_lastfm_fetch_delay(app: AppHandle, seconds: f64) -> AppResult<Preferences> {
    preferences::set_lastfm_fetch_delay(&app, seconds).await
}

#[tauri::command]
pub async fn recompute_genres(
    app: AppHandle,
    state: State<'_, RecomputeGenresState>,
) -> AppResult<Value> {
    state.run(&app).await
}

#[tauri::command]
pub async fn delete_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    id: i64,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "library_remove",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.library_dir.to_string_lossy(),
                "id": id,
            }),
            QUERY_TIMEOUT,
        )
        .await
}
