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
    /// Covers that were too big to draw and got a small rendition, the
    /// original kept beside it as `cover-hq.*`.
    pub renditions: u64,
    /// The state of the tags that came in, straight from the sidecar. See
    /// `ImportRecord::recap` for why it stays untyped here.
    pub recap: Option<Value>,
    /// The user stopped the copy. Not a failure: everything beets had taken
    /// on by then is in the library, and the counts above describe it.
    pub cancelled: bool,
}

/// What the scan promised, carried into the archive so a row can say what was
/// asked of an import and not only what came back.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCounts {
    pub playable: u64,
    pub unplayable: u64,
    /// Counts by extension, as the scan reported them. Kept as the map rather
    /// than a formatted list so the interface names the formats with the same
    /// helper it uses on the live card.
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
    /// Stopped by the user mid-copy. Its own state rather than a flavour of
    /// `Failed`: what landed before the stop is in the library and the row's
    /// counts are real — an archive must not call that an error.
    Cancelled,
}

/// One finished import, as the archive keeps it.
///
/// Only ever written once, at the end. There is deliberately no `running` row:
/// the page driving an import shows it live, and a row stuck half-finished
/// because the app was closed mid-copy would be a claim the archive could never
/// retract.
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
    /// The state of the tags that arrived, shaped by the sidecar
    /// (`sidecar/import_recap.py`) and passed through untyped: Rust has no
    /// reason to know its fields, and the interface reads it directly. None
    /// when the sidecar could not account for the run.
    pub recap: Option<Value>,
    pub finished_at: u64,
}

#[derive(Default)]
pub struct LibraryImportState {
    running: Mutex<bool>,
    /// Where a cancel request lands while an import runs, `None` otherwise.
    ///
    /// A file rather than a protocol message because the sidecar reads one
    /// request at a time — a "stop" sent down the pipe would wait in line
    /// behind the very import it is meant to stop. The sidecar polls for the
    /// file and terminates beets when it appears.
    cancel_file: Mutex<Option<PathBuf>>,
    /// The last folder scanned, and what was found in it.
    ///
    /// Held here rather than sent back down from the page: the numbers are the
    /// ones this process measured, so the archive records a measurement instead
    /// of trusting a webview to hand its own counts back. The UI cannot start an
    /// import without scanning first, so a miss means an import of a folder
    /// nobody looked at — recorded with zeroes rather than refused.
    last_scan: Mutex<Option<(PathBuf, ScanReport)>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl LibraryImportState {
    /// Remember what the scan found, for the import that is about to be asked
    /// for. One slot: the page scans exactly one folder before importing it.
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
    ) -> AppResult<ImportOutcome> {
        let paths = AppPaths::resolve(app)?;
        library_scan::ensure_outside_library(Path::new(folder), &paths.library_root)?;

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

        // Minted here rather than in the sidecar: it is the archive's key for
        // this run *and* the mark stamped on every item beets takes on, so the
        // two have to be the same string and this is the side that keeps records.
        let id = uuid::Uuid::new_v4().to_string();
        let cancel_file = paths.staging_dir.join(format!("import-cancel-{id}"));
        *self.cancel_file.lock().await = Some(cancel_file.clone());

        let result = request(app, sidecar, folder, &id, &cancel_file, &paths).await;

        // Awaited rather than a Drop guard, so a failure cannot leave the flag
        // stuck and the page refusing every later attempt. The cancel slot is
        // cleared the same way — and its file removed, so a stop that landed
        // in the run's last instants cannot arm itself against the next one.
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
            folders: result.as_ref().map(|out| out.folders).unwrap_or(0),
            renditions: result.as_ref().map(|out| out.renditions).unwrap_or(0),
            recap: result.as_ref().ok().and_then(|out| out.recap.clone()),
            finished_at: now_ms(),
        })
        .await;

        result
    }

    /// Whether an import is running right now. For the operations that must
    /// refuse while one is — an erase or a move deleting the very folder
    /// beets is copying into would race it file by file.
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }

    /// Stop the import in flight, if any.
    ///
    /// Writing the file is the whole act: the sidecar's watch thread sees it
    /// within half a second and terminates beets. The call does not wait for
    /// that — the page is already watching the import's own resolution, and
    /// that is where the stop's outcome will arrive.
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

async fn request(
    app: &AppHandle,
    sidecar: &SidecarState,
    folder: &str,
    id: &str,
    cancel_file: &Path,
    paths: &AppPaths,
) -> AppResult<ImportOutcome> {
    let reply = sidecar
        .request(
            app,
            "library_import",
            json!({
                "folder": folder,
                // Stamped on every item beets takes on, so the recap can ask
                // afterwards what *this* run brought in.
                "import_id": id,
                // The import config, not the app's: this is the one path where
                // the album's cover is already on disk beside the tracks, and
                // baking a copy of it into every one of them is how a 1.17 GB
                // library ends up carrying 314 MB of duplicated images.
                "beets_config": paths.beets_import_config,
                // The cover pass that follows the copy needs the library
                // itself, not just the config beets was driven with.
                "beets_db": paths.beets_db,
                "library_dir": paths.music_dir(),
                // Watched by the sidecar while beets runs; see `cancel`.
                "cancel_file": cancel_file,
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
