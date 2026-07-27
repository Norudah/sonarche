//! Running an existing music folder into the library.
//!
//! Thin by design: beets does the walking, the album grouping and the copying,
//! and the sidecar drives it (`sidecar/library_import.py`). What is left here
//! is the part that belongs to the app — refusing a folder that would eat
//! itself, refusing a second import while one is in flight, and letting the
//! call take as long as it takes.
//!
//! Progress does not pass through this module. The sidecar's own events are
//! already forwarded to the webview as `sidecar:event`, so the page listens to
//! `library_import_progress` directly rather than having it relayed twice.

use std::path::Path;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::library_scan;
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Generous, and deliberately so: this is a file copy of a whole collection,
/// on hardware we know nothing about — an external drive over USB 2 is a real
/// place for someone's music to live. The timeout is there to stop a wedged
/// process being waited on forever, not to bound honest work.
const IMPORT_TIMEOUT: Duration = Duration::from_secs(3600 * 6);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcome {
    /// Album folders beets took on. Comparable to the scan's `albumFolders`,
    /// which is what the progress bar counted against.
    pub folders: u64,
}

#[derive(Default)]
pub struct LibraryImportState {
    running: Mutex<bool>,
}

impl LibraryImportState {
    pub async fn run(
        &self,
        app: &AppHandle,
        sidecar: &SidecarState,
        folder: &str,
    ) -> AppResult<ImportOutcome> {
        let paths = AppPaths::resolve(app)?;
        library_scan::ensure_outside_library(Path::new(folder), &paths.library_dir)?;

        {
            // Not because beets would corrupt anything — it takes the library's
            // own lock — but because two imports would interleave their progress
            // on one bar, and the screen has no way to tell them apart.
            let mut running = self.running.lock().await;
            if *running {
                return Err(AppError::InvalidInput(
                    "an import is already running".into(),
                ));
            }
            *running = true;
        }

        let result = request(app, sidecar, folder, &paths).await;

        // Awaited rather than a Drop guard, so a failure cannot leave the flag
        // stuck and the page refusing every later attempt.
        *self.running.lock().await = false;
        result
    }
}

async fn request(
    app: &AppHandle,
    sidecar: &SidecarState,
    folder: &str,
    paths: &AppPaths,
) -> AppResult<ImportOutcome> {
    let reply = sidecar
        .request(
            app,
            "library_import",
            json!({
                "folder": folder,
                "beets_config": paths.beets_config,
            }),
            IMPORT_TIMEOUT,
        )
        .await?;

    Ok(ImportOutcome {
        folders: reply.get("folders").and_then(Value::as_u64).unwrap_or(0),
    })
}
