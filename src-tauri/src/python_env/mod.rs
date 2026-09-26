mod beets_config;
mod interpreter;
mod paths;
mod tools;

pub use paths::{default_library_dir, AppPaths, LibraryRoot};
pub use tools::{deno, ensure_ffmpeg, ensure_fpcalc};

use std::path::Path;
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::proc::command;

use beets_config::write_beets_config;
use interpreter::{discover_python, ensure_runtime, PythonInfo};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvStatus {
    pub python: Option<PythonInfo>,
    /// When bundled, the walkthrough skips the "find Python" step.
    pub python_bundled: bool,
    pub venv_ok: bool,
    pub deps_ok: bool,
    pub library_dir: String,
}

// The venv's python is an absolute symlink to the runtime, which is why the
// runtime is unpacked into app data rather than read from inside the bundle:
// moving the app can't break the link.

pub async fn env_status(app: &AppHandle) -> AppResult<EnvStatus> {
    let paths = AppPaths::resolve(app)?;
    let python = discover_python(&paths).await;
    let python_bundled = tokio::fs::try_exists(&paths.python_archive)
        .await
        .unwrap_or(false)
        || tokio::fs::try_exists(paths.runtime_python())
            .await
            .unwrap_or(false);
    let venv_python = paths.venv_python();
    let venv_ok = tokio::fs::try_exists(&venv_python).await.unwrap_or(false);

    // Rewrite the config on every check so `directory:` follows library moves.
    if venv_ok {
        adopt_library_dir(app).await?;
    }
    let deps_ok = if venv_ok {
        deps_ok_cached(app, &paths, &venv_python).await
    } else {
        false
    };
    Ok(EnvStatus {
        python,
        python_bundled,
        venv_ok,
        deps_ok,
        library_dir: paths.library_root.display().to_string(),
    })
}

/// Checks the venv: imports work and installed versions match the lock.
///
/// The version check is what makes a pin bump in an app update rebuild the
/// venv. The probe takes seconds on slow machines, so its result is cached
/// behind a stamp of its inputs (venv interpreter, requirements, app version).
/// A hand-damaged `site-packages` surfaces when the sidecar starts instead.
async fn deps_ok_cached(app: &AppHandle, paths: &AppPaths, venv_python: &Path) -> bool {
    let stamp_path = paths.venv_dir.join("deps-ok");
    let stamp = deps_stamp(app, paths, venv_python).await;

    if let (Some(stamp), Ok(cached)) = (&stamp, tokio::fs::read_to_string(&stamp_path).await) {
        if cached.trim() == stamp {
            return true;
        }
    }

    // sys.argv[1] is the requirements path. `packaging` is in the lock, so a venv
    // without it fails the probe and is rebuilt.
    const PROBE: &str = "\
import importlib.metadata, sys
import yt_dlp, beets, mutagen
from packaging.requirements import Requirement
for line in open(sys.argv[1], encoding='utf-8'):
    line = line.split('#', 1)[0].strip()
    if not line:
        continue
    req = Requirement(line)
    if req.marker and not req.marker.evaluate():
        continue
    if not req.specifier.contains(importlib.metadata.version(req.name), prereleases=True):
        sys.exit(1)
";
    let ok = command(venv_python)
        .arg("-c")
        .arg(PROBE)
        .arg(&paths.requirements)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);
    if ok {
        if let Some(stamp) = &stamp {
            let _ = tokio::fs::write(&stamp_path, stamp).await;
        }
    } else {
        let _ = tokio::fs::remove_file(&stamp_path).await;
    }
    ok
}

/// The probe's inputs as one line; `None` if any can't be stat'ed.
async fn deps_stamp(app: &AppHandle, paths: &AppPaths, venv_python: &Path) -> Option<String> {
    fn token(meta: &std::fs::Metadata) -> Option<String> {
        let mtime = meta
            .modified()
            .ok()?
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs();
        Some(format!("{mtime}.{}", meta.len()))
    }
    let python = tokio::fs::metadata(venv_python).await.ok()?;
    let requirements = tokio::fs::metadata(&paths.requirements).await.ok()?;
    Some(format!(
        "v{} python {} requirements {}",
        app.package_info().version,
        token(&python)?,
        token(&requirements)?,
    ))
}

fn emit_log(app: &AppHandle, line: &str) {
    let _ = app.emit("setup:log", line);
}

/// Runs a command, streaming its output lines as `setup:log` events.
async fn run_streamed(app: &AppHandle, mut cmd: Command, step: &str) -> AppResult<()> {
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    fn forward<R>(app: AppHandle, reader: R)
    where
        R: tokio::io::AsyncRead + Unpin + Send + 'static,
    {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(reader).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit_log(&app, &line);
            }
        });
    }
    if let Some(stdout) = child.stdout.take() {
        forward(app.clone(), stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        forward(app.clone(), stderr);
    }

    let status = child.wait().await?;
    if !status.success() {
        return Err(AppError::Setup(format!("{step} failed (exit {status})")));
    }
    Ok(())
}

/// Points beets' `directory:` and the webview asset scope at the current
/// library folder. `tauri.conf.json` only covers the default location.
///
/// Called after a move and on every environment check, so a library moved
/// while the app was closed is repaired at launch.
pub async fn adopt_library_dir(app: &AppHandle) -> AppResult<()> {
    let paths = AppPaths::resolve(app)?;
    {
        let root = paths.library_root.clone();
        // Sync fs, also used from the setup hook.
        tauri::async_runtime::spawn_blocking(move || crate::library_layout::ensure_zones(&root))
            .await
            .map_err(|err| AppError::Setup(format!("layout task panicked: {err}")))??;
    }
    if let Some(parent) = paths.beets_config.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    write_beets_config(&paths).await?;
    if let Err(err) = app
        .asset_protocol_scope()
        .allow_directory(&paths.library_root, true)
    {
        // Not fatal: only a moved library is affected, and it still browses.
        eprintln!("[library] could not widen the asset scope: {err}");
    }
    Ok(())
}

pub async fn setup_env(app: &AppHandle) -> AppResult<EnvStatus> {
    let paths = AppPaths::resolve(app)?;
    ensure_runtime(app, &paths).await?;
    let python = discover_python(&paths)
        .await
        .ok_or(AppError::PythonNotFound)?;

    tokio::fs::create_dir_all(&paths.staging_dir).await?;
    tokio::fs::create_dir_all(paths.beets_config.parent().unwrap_or(&paths.staging_dir)).await?;
    tokio::fs::create_dir_all(&paths.music_dir()).await?;

    emit_log(
        app,
        &format!("Python: {} ({})", python.path, python.version),
    );
    emit_log(app, "Creating virtual environment...");
    let mut venv_cmd = command(&python.path);
    venv_cmd
        .arg("-m")
        .arg("venv")
        .arg("--clear")
        .arg(&paths.venv_dir);
    run_streamed(app, venv_cmd, "venv creation").await?;

    // Bundled wheels when present: offline and much faster.
    let vendored = tokio::fs::try_exists(&paths.wheels_dir)
        .await
        .unwrap_or(false);
    emit_log(
        app,
        if vendored {
            "Installing dependencies from the bundled wheels..."
        } else {
            "Installing dependencies (this can take a few minutes)..."
        },
    );
    let mut pip_cmd = command(paths.venv_python());
    pip_cmd
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--disable-pip-version-check")
        // requirements.txt is the fully resolved tree; resolving again would pull
        // back packages we exclude on purpose.
        .arg("--no-deps")
        // Fail on a missing wheel instead of falling back to a source build.
        .arg("--only-binary=:all:");
    if vendored {
        pip_cmd
            .arg("--no-index")
            .arg("--find-links")
            .arg(&paths.wheels_dir);
    }
    pip_cmd.arg("-r").arg(&paths.requirements);
    run_streamed(app, pip_cmd, "pip install").await?;

    write_beets_config(&paths).await?;
    emit_log(app, "Environment ready.");
    env_status(app).await
}
