use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::sidecar::SidecarState;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const IMPORT_TIMEOUT: Duration = Duration::from_secs(10 * 60);
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
pub async fn download_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    url: String,
) -> AppResult<Value> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "download",
            json!({
                "url": url,
                "staging_dir": paths.staging_dir.to_string_lossy(),
            }),
            DOWNLOAD_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn import_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    path: String,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    let staging = paths.staging_dir.canonicalize()?;
    let file = std::path::Path::new(&path)
        .canonicalize()
        .map_err(|_| AppError::InvalidInput("file not found".into()))?;
    if !file.starts_with(&staging) {
        return Err(AppError::InvalidInput(
            "only files from the staging directory can be imported".into(),
        ));
    }
    state
        .request(
            &app,
            "import",
            json!({
                "path": file.to_string_lossy(),
                "beets_config": paths.beets_config.to_string_lossy(),
            }),
            IMPORT_TIMEOUT,
        )
        .await
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
