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
    /// The interpreter in use, once there is one.
    pub python: Option<PythonInfo>,
    /// Whether the app ships its own. When it does, finding an interpreter is
    /// not something the user can fail at, so the walkthrough drops that step
    /// entirely rather than showing a rung nobody has to climb.
    pub python_bundled: bool,
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
    pub genres_tree: PathBuf,
    pub genres_whitelist: PathBuf,
    pub tools_dir: PathBuf,
    /// The interpreter the app ships, still packed. Unpacked at setup rather
    /// than laid out as loose resources: the tree is full of symlinks and
    /// executable bits, and `tar` is the thing that reliably restores both.
    pub python_archive: PathBuf,
    /// Where that archive lands. `runtime/python/bin/python3` afterwards.
    pub runtime_dir: PathBuf,
    /// Wheels shipped alongside, so the install needs no network.
    pub wheels_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve(app: &AppHandle) -> AppResult<Self> {
        let data = app.path().app_data_dir()?;
        let sidecar_dir = app
            .path()
            .resolve("sidecar", tauri::path::BaseDirectory::Resource)?;
        let resource = |name: &str| {
            app.path()
                .resolve(name, tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| data.join(name))
        };
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
            genres_tree: sidecar_dir.join("genres-tree.yaml"),
            genres_whitelist: sidecar_dir.join("genres-whitelist.txt"),
            tools_dir: data.join("tools"),
            python_archive: resource("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: resource("wheels"),
        })
    }

    pub fn venv_python(&self) -> PathBuf {
        self.venv_dir.join("bin").join("python3")
    }

    /// The shipped interpreter once unpacked. Not necessarily present: it only
    /// exists after setup has run, and not at all in a build made without
    /// `npm run prepare:runtime`.
    pub fn runtime_python(&self) -> PathBuf {
        self.runtime_dir.join("python").join("bin").join("python3")
    }

    pub fn fpcalc(&self) -> PathBuf {
        self.tools_dir.join("fpcalc")
    }
}

/// Pinned Chromaprint release; fpcalc ships statically linked (no ffmpeg needed).
const FPCALC_URL: &str = "https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-macos-universal.tar.gz";
const FPCALC_ARCHIVE_BIN: &str = "chromaprint-fpcalc-1.5.1-macos-universal/fpcalc";

/// Download fpcalc into the app-owned tools dir on first use. Self-healing,
/// like the venv: a failure only degrades enrichment, never the app.
pub async fn ensure_fpcalc(paths: &AppPaths) -> AppResult<()> {
    let dest = paths.fpcalc();
    if tokio::fs::try_exists(&dest).await.unwrap_or(false) {
        return Ok(());
    }
    tokio::fs::create_dir_all(&paths.tools_dir).await?;
    let archive = paths.tools_dir.join("fpcalc.tar.gz");

    eprintln!("[tools] downloading fpcalc from {FPCALC_URL}");
    let status = Command::new("/usr/bin/curl")
        .args(["-fsSL", "-o"])
        .arg(&archive)
        .arg(FPCALC_URL)
        .stdin(Stdio::null())
        .status()
        .await?;
    if !status.success() {
        return Err(AppError::Setup("fpcalc download failed".into()));
    }

    let status = Command::new("/usr/bin/tar")
        .arg("-xzf")
        .arg(&archive)
        .arg("-C")
        .arg(&paths.tools_dir)
        // BSD tar treats everything after the first member name as more member
        // names, so options must come before FPCALC_ARCHIVE_BIN.
        .arg("--strip-components=1")
        .arg(FPCALC_ARCHIVE_BIN)
        .stdin(Stdio::null())
        .status()
        .await?;
    let _ = tokio::fs::remove_file(&archive).await;
    if !status.success() {
        return Err(AppError::Setup("fpcalc extraction failed".into()));
    }
    if !tokio::fs::try_exists(&dest).await.unwrap_or(false) {
        return Err(AppError::Setup("fpcalc missing after extraction".into()));
    }
    eprintln!("[tools] fpcalc ready at {}", dest.display());
    Ok(())
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

/// The interpreter to build the venv from.
///
/// The shipped one wins whenever it is unpacked: it is the version the wheels
/// were resolved against, and it cannot be upgraded out from under us by a
/// `brew upgrade`. The PATH-free search is the fallback, for a build made
/// without `npm run prepare:runtime` and for installs that predate bundling.
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

/// Unpack the shipped interpreter, once. A no-op when the app carries none.
async fn ensure_runtime(app: &AppHandle, paths: &AppPaths) -> AppResult<()> {
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
    // Wiped first: a half-extracted tree from an interrupted run would pass the
    // existence check above on some paths and fail on others.
    let _ = tokio::fs::remove_dir_all(&paths.runtime_dir).await;
    tokio::fs::create_dir_all(&paths.runtime_dir).await?;

    let mut cmd = Command::new("/usr/bin/tar");
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

// A venv's `bin/python3` is an absolute symlink to the interpreter it was built
// from, so a bundled interpreter raises an obvious question: what happens when
// the user drags the app from Downloads to Applications? Nothing — and that is
// precisely why the archive is unpacked into the app data directory instead of
// being read in place from inside the .app. That path does not travel with the
// bundle, so the symlink cannot go stale and no repair machinery is warranted.
// Deleting the runtime is the only way to break it, and re-running the setup
// puts it back at the same path, which heals the symlink on its own.

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
        python_bundled,
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

/// Single config site for beets: the CLI importer reads it via `--config` and
/// the sidecar's in-process beets via BEETSDIR. Regenerated on every launch.
async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    let config = format!(
        r#"directory: "{library}"
library: "{db}"
import:
  move: yes
  write: yes
  quiet_fallback: asis
  # Staged files are imported untagged by design, so beets' duplicate check
  # can only ever collide blank-vs-blank (enriched items have real tags).
  # `skip` (the quiet default) silently drops every album-batch track after
  # the first one; real re-download duplicates never collide anyway.
  duplicate_action: keep
# cover-hq.* is Sonarche's own file (the full-size CAA art next to beets'
# cover.jpg); declaring it clutter lets beets prune a folder that only has
# it left after an album is moved or merged away.
clutter: ["Thumbs.DB", ".DS_Store", "cover-hq.jpg", "cover-hq.png"]
plugins: musicbrainz fetchart embedart lastgenre
musicbrainz:
  genres: yes
fetchart:
  auto: yes
embedart:
  auto: yes
# auto: no — the import stage never runs lastgenre; enrich calls _get_genre()
# itself. Canonical tree + whitelist are ours (bundled sidecar resources):
# the stored genre is the most specific tree node (count 3, specific first),
# the browse bucket is derived by climbing the same tree.
lastgenre:
  auto: no
  source: track
  count: 3
  canonical: "{tree}"
  whitelist: "{whitelist}"
  prefer_specific: yes
  cleanup_existing: yes
  fallback: null
ui:
  color: no
"#,
        library = paths.library_dir.display(),
        db = paths.beets_db.display(),
        tree = paths.genres_tree.display(),
        whitelist = paths.genres_whitelist.display(),
    );
    tokio::fs::write(&paths.beets_config, config).await?;
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

    // Shipped wheels when we have them: beets pulls numpy, scipy, numba and
    // llvmlite, which is most of a 76 MB download and the whole reason the
    // install used to be measured in minutes. `--no-index` also makes this the
    // one step that no longer needs the network.
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
    let mut pip_cmd = Command::new(paths.venv_python());
    pip_cmd
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--disable-pip-version-check");
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
