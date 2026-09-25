//! Importing an existing music folder. beets walks, groups and copies, driven
//! by `sidecar/library_import.py`; this module guards the folder, allows one
//! import at a time, and archives the result. Progress reaches the webview
//! directly as sidecar `library_import_progress` events.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::library_scan::{self, ScanReport};
use crate::python_env::AppPaths;
use crate::sidecar::SidecarState;

/// Only guards against a wedged process; copies from slow drives take long.
const IMPORT_TIMEOUT: Duration = Duration::from_secs(3600 * 6);

/// Validated here too, since it selects a beets CLI flag.
const GROUPINGS: &[&str] = &["folder", "tags", "tracks"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcome {
    /// Comparable to the scan's `albumFolders`.
    pub folders: u64,
    /// Oversized covers scaled down in place.
    pub renditions: u64,
    /// Tag quality recap from the sidecar, kept untyped.
    pub recap: Option<Value>,
    /// Stopped by the user; what was copied is in the library.
    pub cancelled: bool,
}

/// What the scan found, archived with the result.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCounts {
    pub playable: u64,
    pub unplayable: u64,
    pub unplayable_by_extension: BTreeMap<String, u64>,
    pub bytes: u64,
    pub album_folders: u64,
}

impl From<&ScanReport> for ScanCounts {
    fn from(report: &ScanReport) -> Self {
        Self {
            playable: report.playable,
            unplayable: report.unplayable,
            unplayable_by_extension: report.unplayable_by_extension.clone(),
            bytes: report.bytes,
            album_folders: report.album_folders,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportStatus {
    Done,
    Failed,
    /// Not a failure: what landed before the stop is real.
    Cancelled,
}

/// One finished import. Written once, at the end, so no row is ever left
/// half-finished by a closed app.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRecord {
    pub id: String,
    pub folder: String,
    pub status: ImportStatus,
    pub error: Option<String>,
    pub scan: ScanCounts,
    pub folders: u64,
    pub renditions: u64,
    pub grouping: Option<String>,
    pub category: Option<String>,
    /// Tag recap from `sidecar/import_recap.py`, passed through untyped.
    pub recap: Option<Value>,
    /// When the run was undone; the row stays.
    pub undone_at: Option<u64>,
    pub finished_at: u64,
}

#[derive(Default)]
pub struct LibraryImportState {
    running: Mutex<bool>,
    /// Cancel signal file for the running import. A file, because the sidecar
    /// reads one request at a time and a message would queue behind the import.
    cancel_file: Mutex<Option<PathBuf>>,
    /// The last scan, archived with the import: counts measured here rather than
    /// trusted from the webview.
    last_scan: Mutex<Option<(PathBuf, ScanReport)>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl LibraryImportState {
    pub async fn remember_scan(&self, root: &Path, report: &ScanReport) {
        *self.last_scan.lock().await = Some((root.to_path_buf(), report.clone()));
    }

    async fn scan_counts(&self, folder: &Path) -> ScanCounts {
        match &*self.last_scan.lock().await {
            Some((scanned, report)) if scanned == folder => ScanCounts::from(report),
            _ => ScanCounts::default(),
        }
    }

    pub async fn run(
        &self,
        app: &AppHandle,
        sidecar: &SidecarState,
        jobs: &JobsState,
        folder: &str,
        grouping: &str,
        category: Option<&str>,
    ) -> AppResult<ImportOutcome> {
        if !GROUPINGS.contains(&grouping) {
            return Err(AppError::InvalidInput(format!(
                "unknown grouping: {grouping}"
            )));
        }
        let paths = AppPaths::resolve(app)?;
        library_scan::ensure_outside_library(Path::new(folder), &paths.library_root)?;

        {
            // Two imports would interleave on one progress bar.
            let mut running = self.running.lock().await;
            if *running {
                return Err(AppError::InvalidInput(
                    "an import is already running".into(),
                ));
            }
            *running = true;
        }

        // Also the mark stamped on every imported item.
        let id = uuid::Uuid::new_v4().to_string();
        let cancel_file = paths.staging_dir.join(format!("import-cancel-{id}"));
        *self.cancel_file.lock().await = Some(cancel_file.clone());

        let result = request(
            app,
            sidecar,
            Run {
                folder,
                grouping,
                category,
                id: &id,
                cancel_file: &cancel_file,
            },
            &paths,
        )
        .await;

        // Reset explicitly (not in a Drop guard), and remove the cancel file so a
        // late stop can't hit the next run.
        *self.running.lock().await = false;
        *self.cancel_file.lock().await = None;
        let _ = tokio::fs::remove_file(&cancel_file).await;

        jobs.record_import(ImportRecord {
            id,
            folder: folder.to_string(),
            status: match &result {
                Ok(outcome) if outcome.cancelled => ImportStatus::Cancelled,
                Ok(_) => ImportStatus::Done,
                Err(_) => ImportStatus::Failed,
            },
            error: result.as_ref().err().map(|err| err.to_string()),
            scan: self.scan_counts(Path::new(folder)).await,
            grouping: Some(grouping.to_string()),
            category: category.map(str::to_string),
            folders: result.as_ref().map(|out| out.folders).unwrap_or(0),
            renditions: result.as_ref().map(|out| out.renditions).unwrap_or(0),
            recap: result.as_ref().ok().and_then(|out| out.recap.clone()),
            undone_at: None,
            finished_at: now_ms(),
        })
        .await;

        result
    }

    /// For operations that must not run during an import (erase, move).
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }

    /// Writes the cancel file; the sidecar terminates beets within half a second.
    /// The import call itself resolves as cancelled.
    pub async fn cancel(&self) -> AppResult<()> {
        let target = self.cancel_file.lock().await.clone();
        match target {
            Some(path) => {
                tokio::fs::write(&path, b"cancel").await?;
                Ok(())
            }
            None => Err(AppError::InvalidInput("no import is running".into())),
        }
    }
}

struct Run<'a> {
    folder: &'a str,
    grouping: &'a str,
    category: Option<&'a str>,
    id: &'a str,
    cancel_file: &'a Path,
}

async fn request(
    app: &AppHandle,
    sidecar: &SidecarState,
    run: Run<'_>,
    paths: &AppPaths,
) -> AppResult<ImportOutcome> {
    let reply = sidecar
        .request(
            app,
            "library_import",
            json!({
                "folder": run.folder,
                "grouping": run.grouping,
                "category": run.category,
                "import_id": run.id,
                // The import flavour, which doesn't embed covers.
                "beets_config": paths.beets_import_config,
                // For the cover pass after the copy.
                "beets_db": paths.beets_db,
                "library_dir": paths.music_dir(),
                "cancel_file": run.cancel_file,
            }),
            IMPORT_TIMEOUT,
        )
        .await?;

    Ok(ImportOutcome {
        folders: reply.get("folders").and_then(Value::as_u64).unwrap_or(0),
        renditions: reply.get("renditions").and_then(Value::as_u64).unwrap_or(0),
        recap: reply.get("recap").filter(|recap| !recap.is_null()).cloned(),
        cancelled: reply
            .get("cancelled")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

/// The last import (cancelled ones included) of this folder, a parent or a
/// child, that landed something. beets' incremental guard skips seen folders
/// silently, so the UI names the earlier run.
pub fn overlapping_import(records: &[ImportRecord], folder: &Path) -> Option<ImportRecord> {
    records
        .iter()
        .filter(|record| !matches!(record.status, ImportStatus::Failed))
        .find(|record| {
            let seen = Path::new(&record.folder);
            seen == folder || seen.starts_with(folder) || folder.starts_with(seen)
        })
        .cloned()
}
