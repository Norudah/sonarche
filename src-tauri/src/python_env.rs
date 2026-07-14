use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};

const MIN_PYTHON: (u64, u64) = (3, 10);

/// Fixed candidate locations, most specific first. Never rely on PATH.
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

#[derive(Debug, Clone, Serialize)]
pub struct PythonInfo {
    pub path: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvStatus {
    pub python: Option<PythonInfo>,
    pub venv_ok: bool,
    pub deps_ok: bool,
    pub library_dir: String,
}

pub struct AppPaths {
    pub venv_dir: PathBuf,
    pub staging_dir: PathBuf,
    pub beets_config: PathBuf,
    pub beets_db: PathBuf,
    pub library_dir: PathBuf,
    pub sidecar_main: PathBuf,
    pub requirements: PathBuf,
}

impl AppPaths {
    pub fn resolve(app: &AppHandle) -> AppResult<Self> {
        let data = app.path().app_data_dir()?;
        let sidecar_dir = app
            .path()
            .resolve("sidecar", tauri::path::BaseDirectory::Resource)?;
        let library_dir = app
            .path()
            .audio_dir()
            .map(|d| d.join("Sonarche"))
            .unwrap_or_else(|_| data.join("Library"));
        Ok(Self {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_db: data.join("beets").join("library.db"),
            library_dir,
            sidecar_main: sidecar_dir.join("main.py"),
            requirements: sidecar_dir.join("requirements.txt"),
        })
    }

    pub fn venv_python(&self) -> PathBuf {
        self.venv_dir.join("bin").join("python3")
    }
}

async fn probe(path: &str) -> Option<PythonInfo> {
    let output = Command::new(path)
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

pub async fn discover_python() -> Option<PythonInfo> {
    for candidate in PYTHON_CANDIDATES {
        if let Some(info) = probe(candidate).await {
            return Some(info);
        }
    }
    None
}

pub async fn env_status(app: &AppHandle) -> AppResult<EnvStatus> {
    let paths = AppPaths::resolve(app)?;
    let python = discover_python().await;
    let venv_python = paths.venv_python();
    let venv_ok = tokio::fs::try_exists(&venv_python).await.unwrap_or(false);
    // Keep the beets config's `directory:` in sync with library_dir on every check, not just
    // first setup — otherwise an existing install can keep importing into a stale path after
    // library_dir changes (e.g. a rename), while the asset protocol scope only allows the new one.
    if venv_ok {
        tokio::fs::create_dir_all(&paths.library_dir).await?;
        if let Some(parent) = paths.beets_config.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        write_beets_config(&paths).await?;
    }
    let deps_ok = if venv_ok {
        Command::new(&venv_python)
            .args(["-c", "import yt_dlp, beets, mutagen"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    } else {
        false
    };
    Ok(EnvStatus {
        python,
        venv_ok,
        deps_ok,
        library_dir: paths.library_dir.display().to_string(),
    })
}

fn emit_log(app: &AppHandle, line: &str) {
    let _ = app.emit("setup:log", line);
}

/// Run a command streaming stdout+stderr lines to the webview as `setup:log` events.
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

async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    let config = format!(
        r#"directory: "{library}"
library: "{db}"
import:
  move: yes
  write: yes
  quiet_fallback: asis
plugins: musicbrainz fetchart embedart
fetchart:
  auto: yes
embedart:
  auto: yes
ui:
  color: no
"#,
        library = paths.library_dir.display(),
        db = paths.beets_db.display(),
    );
    tokio::fs::write(&paths.beets_config, config).await?;
    Ok(())
}

pub async fn setup_env(app: &AppHandle) -> AppResult<EnvStatus> {
    let paths = AppPaths::resolve(app)?;
    let python = discover_python().await.ok_or(AppError::PythonNotFound)?;

    tokio::fs::create_dir_all(&paths.staging_dir).await?;
    tokio::fs::create_dir_all(paths.beets_config.parent().unwrap_or(&paths.staging_dir)).await?;
    tokio::fs::create_dir_all(&paths.library_dir).await?;

    emit_log(
        app,
        &format!("Python: {} ({})", python.path, python.version),
    );
    emit_log(app, "Creating virtual environment...");
    let mut venv_cmd = Command::new(&python.path);
    venv_cmd
        .arg("-m")
        .arg("venv")
        .arg("--clear")
        .arg(&paths.venv_dir);
    run_streamed(app, venv_cmd, "venv creation").await?;

    emit_log(
        app,
        "Installing dependencies (this can take a few minutes)...",
    );
    let mut pip_cmd = Command::new(paths.venv_python());
    pip_cmd
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--disable-pip-version-check")
        .arg("-r")
        .arg(&paths.requirements);
    run_streamed(app, pip_cmd, "pip install").await?;

    write_beets_config(&paths).await?;
    emit_log(app, "Environment ready.");
    env_status(app).await
}
