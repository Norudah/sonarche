//! Where the app's diagnostics go on a machine that has no console.
//!
//! The sidecar already prints a full traceback for every exception it catches;
//! it went to `eprintln!`, and a `windows_subsystem = "windows"` binary owns no
//! console, so on Windows that was nowhere at all. A user hitting a bug had
//! literally nothing to send back — which is what turned one encoding bug into
//! several rounds of guessing.
//!
//! A file, not a logging framework: there is one producer, the lines arrive
//! pre-formatted, and nothing here needs levels, filters or targets.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Manager};

/// Rotated at, not truncated to: a session that reproduces a bug has to survive
/// the next launch, so the previous run moves aside instead of disappearing.
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

/// Open the log for this run. Failing to do so is never fatal — an app that
/// cannot write its log still has to start.
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

/// One line to the log, and to stderr for whoever has a terminal attached.
///
/// Silent on every failure by design: a diagnostic that can take the app down
/// with it is worse than no diagnostic.
pub fn write(line: &str) {
    eprintln!("{line}");
    if let Some(sink) = SINK.get() {
        if let Ok(mut file) = sink.lock() {
            let _ = writeln!(file, "{line}");
            let _ = file.flush();
        }
    }
}

/// Forget what the log already holds, keeping the sink usable.
///
/// For the data erase: log lines name tracks, folders and URLs, which is user
/// data in the sense that matters there. The live file is truncated through
/// the open handle rather than deleted — the sink stays valid for the very
/// next line, starting with the erase's own receipt — and the rotated
/// previous run is removed outright. Same silence-on-failure rule as `write`.
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
