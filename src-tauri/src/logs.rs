//! The app log file (`sonarche.log`). A windowed Windows binary has no
//! console, so stderr alone would be lost.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Manager};

/// Rotated so the previous run survives the next launch.
const MAX_BYTES: u64 = 2 * 1024 * 1024;

static SINK: OnceLock<Mutex<fs::File>> = OnceLock::new();

pub fn path(app: &AppHandle) -> Option<PathBuf> {
    Some(
        app.path()
            .app_data_dir()
            .ok()?
            .join("logs")
            .join("sonarche.log"),
    )
}

/// Opens the log for this run; failure is never fatal.
pub fn init(app: &AppHandle) {
    let Some(target) = path(app) else { return };
    let Some(dir) = target.parent() else { return };
    if fs::create_dir_all(dir).is_err() {
        return;
    }
    if fs::metadata(&target)
        .map(|m| m.len() > MAX_BYTES)
        .unwrap_or(false)
    {
        let _ = fs::rename(&target, target.with_extension("log.1"));
    }
    if let Ok(file) = OpenOptions::new().create(true).append(true).open(&target) {
        let _ = SINK.set(Mutex::new(file));
    }
    write(&format!(
        "--- sonarche {} starting ---",
        env!("CARGO_PKG_VERSION")
    ));
}

/// Writes to the log and stderr. Silent on failure.
pub fn write(line: &str) {
    eprintln!("{line}");
    if let Some(sink) = SINK.get() {
        if let Ok(mut file) = sink.lock() {
            let _ = writeln!(file, "{line}");
            let _ = file.flush();
        }
    }
}

/// Empties the log for a data erase (it names tracks and folders): truncates
/// through the open handle so the sink stays usable, and deletes the rotated
/// file.
pub fn clear(app: &AppHandle) {
    if let Some(sink) = SINK.get() {
        if let Ok(file) = sink.lock() {
            let _ = file.set_len(0);
        }
    }
    if let Some(target) = path(app) {
        let _ = fs::remove_file(target.with_extension("log.1"));
    }
}
