//! Finding the Python interpreter the venv is built from, bundled or installed.

use std::process::Stdio;

use serde::Serialize;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::proc::{command, SYSTEM_TAR};

use super::paths::AppPaths;
use super::{emit_log, run_streamed};

const MIN_PYTHON: (u64, u64) = (3, 10);

/// Fallback interpreter locations for builds without a bundled runtime.
/// Never PATH. Empty on Windows, which always ships the interpreter.
#[cfg(target_os = "macos")]
const PYTHON_CANDIDATES: &[&str] = &[
    "/opt/homebrew/bin/python3.14",
    "/opt/homebrew/bin/python3.13",
    "/opt/homebrew/bin/python3.12",
    "/opt/homebrew/bin/python3.11",
    "/opt/homebrew/bin/python3.10",
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3.13",
    "/usr/local/bin/python3.12",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
];

#[cfg(not(target_os = "macos"))]
const PYTHON_CANDIDATES: &[&str] = &[];

#[derive(Debug, Clone, Serialize)]
pub struct PythonInfo {
    pub path: String,
    pub version: String,
}

pub(super) async fn probe(path: &str) -> Option<PythonInfo> {
    let output = command(path)
        .args(["-c", "import sys; print('%d.%d.%d' % sys.version_info[:3])"])
        .stdin(Stdio::null())
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut parts = version.split('.').filter_map(|p| p.parse::<u64>().ok());
    let (major, minor) = (parts.next()?, parts.next()?);
    if (major, minor) < MIN_PYTHON {
        return None;
    }
    Some(PythonInfo {
        path: path.to_string(),
        version,
    })
}

/// The interpreter to build the venv from: the bundled one when unpacked
/// (the wheels were resolved against it), else a PATH-free search.
pub async fn discover_python(paths: &AppPaths) -> Option<PythonInfo> {
    let runtime = paths.runtime_python();
    if let Some(info) = probe(&runtime.to_string_lossy()).await {
        return Some(info);
    }
    for candidate in PYTHON_CANDIDATES {
        if let Some(info) = probe(candidate).await {
            return Some(info);
        }
    }
    None
}

/// Unpacks the bundled interpreter once. No-op when none is bundled.
pub(super) async fn ensure_runtime(app: &AppHandle, paths: &AppPaths) -> AppResult<()> {
    if tokio::fs::try_exists(paths.runtime_python())
        .await
        .unwrap_or(false)
    {
        return Ok(());
    }
    if !tokio::fs::try_exists(&paths.python_archive)
        .await
        .unwrap_or(false)
    {
        return Ok(());
    }

    emit_log(app, "Unpacking the bundled Python...");
    // A half-extracted tree from an interrupted run would be inconsistent.
    let _ = tokio::fs::remove_dir_all(&paths.runtime_dir).await;
    tokio::fs::create_dir_all(&paths.runtime_dir).await?;

    let mut cmd = command(SYSTEM_TAR);
    cmd.arg("-xzf")
        .arg(&paths.python_archive)
        .arg("-C")
        .arg(&paths.runtime_dir);
    run_streamed(app, cmd, "python extraction").await?;

    if !tokio::fs::try_exists(paths.runtime_python())
        .await
        .unwrap_or(false)
    {
        return Err(AppError::Setup(
            "bundled Python missing after unpack".into(),
        ));
    }
    Ok(())
}
