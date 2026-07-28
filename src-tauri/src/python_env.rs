use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::proc::{command, SYSTEM_CURL, SYSTEM_TAR};

const MIN_PYTHON: (u64, u64) = (3, 10);

/// Fixed candidate locations, most specific first. Never rely on PATH.
///
/// The fallback for a build made without `npm run prepare:runtime`, and for
/// macOS installs that predate bundling. Empty on Windows: there is no
/// conventional location to guess at (a system Python lands under a versioned
/// `%LOCALAPPDATA%` path, or in the Store's own sandbox), and no Windows build
/// ever shipped without the interpreter — so a guess could only ever be wrong.
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
    /// The same config with cover embedding off, used only by the library
    /// import. See `write_beets_config` for why the two cannot be one.
    pub beets_import_config: PathBuf,
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
    /// Where that archive lands. See `runtime_python` for what sits inside.
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
            beets_import_config: data.join("beets").join("config-import.yaml"),
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

    /// `venv/bin/python3` on Unix, `venv\Scripts\python.exe` on Windows — the
    /// layout is `venv`'s own, not ours, and there is no common spelling.
    pub fn venv_python(&self) -> PathBuf {
        if cfg!(windows) {
            self.venv_dir.join("Scripts").join("python.exe")
        } else {
            self.venv_dir.join("bin").join("python3")
        }
    }

    /// The shipped interpreter once unpacked. Not necessarily present: it only
    /// exists after setup has run, and not at all in a build made without
    /// `npm run prepare:runtime`.
    ///
    /// The Windows distribution keeps the executable at the root of the tree
    /// rather than under `bin/`.
    pub fn runtime_python(&self) -> PathBuf {
        let root = self.runtime_dir.join("python");
        if cfg!(windows) {
            root.join("python.exe")
        } else {
            root.join("bin").join("python3")
        }
    }

    pub fn fpcalc(&self) -> PathBuf {
        self.tools_dir.join(if cfg!(windows) {
            "fpcalc.exe"
        } else {
            "fpcalc"
        })
    }
}

/// Pinned Chromaprint release; fpcalc ships statically linked (no ffmpeg needed).
///
/// The Windows asset is a zip rather than a tarball, which changes nothing at
/// the call site: bsdtar reads both, and `-xf` lets it work out which.
#[cfg(target_os = "macos")]
const FPCALC_URL: &str = "https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-macos-universal.tar.gz";
#[cfg(target_os = "macos")]
const FPCALC_ARCHIVE_BIN: &str = "chromaprint-fpcalc-1.5.1-macos-universal/fpcalc";

#[cfg(target_os = "windows")]
const FPCALC_URL: &str = "https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-windows-x86_64.zip";
#[cfg(target_os = "windows")]
const FPCALC_ARCHIVE_BIN: &str = "chromaprint-fpcalc-1.5.1-windows-x86_64/fpcalc.exe";

// Rather than an unresolved-name error a hundred lines further down: the two
// constants above are the whole of what a new platform has to add here.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
compile_error!("no fpcalc asset pinned for this platform — add one beside FPCALC_URL");

/// Download fpcalc into the app-owned tools dir on first use. Self-healing,
/// like the venv: a failure only degrades enrichment, never the app.
pub async fn ensure_fpcalc(paths: &AppPaths) -> AppResult<()> {
    let dest = paths.fpcalc();
    if tokio::fs::try_exists(&dest).await.unwrap_or(false) {
        return Ok(());
    }
    tokio::fs::create_dir_all(&paths.tools_dir).await?;
    // Extension-free on purpose: the asset is a tarball on macOS and a zip on
    // Windows, and bsdtar sniffs the format rather than trusting the name.
    let archive = paths.tools_dir.join("fpcalc-archive");

    eprintln!("[tools] downloading fpcalc from {FPCALC_URL}");
    let status = command(SYSTEM_CURL)
        .args(["-fsSL", "-o"])
        .arg(&archive)
        .arg(FPCALC_URL)
        .stdin(Stdio::null())
        .status()
        .await?;
    if !status.success() {
        return Err(AppError::Setup("fpcalc download failed".into()));
    }

    let status = command(SYSTEM_TAR)
        .arg("-xf")
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
        command(&venv_python)
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
///
/// Written twice, differing in one line. `embedart: auto` bakes the album's
/// cover into every track, which costs nothing on a download — the staged file
/// is alone in an empty folder when the import stage runs, so there is no art
/// to bake — and is ruinous on a library import, where the cover is already
/// sitting beside the tracks. Measured on a real import: 314 MB of duplicated
/// images across 1.17 GB, one full-size copy per track, 88 MB for a single
/// 18-track album. The interface reads the folder's file and never the tag, so
/// the embedding only ever served other players.
///
/// Two files rather than a flag on one, because beets takes a single
/// `--config` and offers no way to override a key from the command line.
async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    write_config_file(paths, &paths.beets_config, true).await?;
    write_config_file(paths, &paths.beets_import_config, false).await
}

async fn write_config_file(paths: &AppPaths, target: &Path, embed_art: bool) -> AppResult<()> {
    tokio::fs::write(target, beets_config_yaml(paths, embed_art)).await?;
    Ok(())
}

/// A path as a YAML scalar.
///
/// Single-quoted, and that is the whole point. Inside double quotes YAML treats
/// `\` as an escape introducer, so `C:\Users\…` opens with `\U` — the start of
/// an eight-digit unicode escape — and beets refused to load its own config
/// before it ever saw a track. Every import on Windows failed on this, from the
/// first build.
///
/// A single-quoted scalar has exactly one escape, a doubled `'`, which is why
/// this is a function and not a pair of quote characters at the call site: a
/// Windows user named O'Brien has an apostrophe in every path they own.
fn yaml_scalar(path: &Path) -> String {
    format!("'{}'", path.display().to_string().replace('\'', "''"))
}

fn beets_config_yaml(paths: &AppPaths, embed_art: bool) -> String {
    format!(
        r#"directory: {library}
library: {db}
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
  auto: {embed_art}
# auto: no — the import stage never runs lastgenre; enrich calls _get_genre()
# itself. Canonical tree + whitelist are ours (bundled sidecar resources):
# the stored genre is the most specific tree node (count 3, specific first),
# the browse bucket is derived by climbing the same tree.
lastgenre:
  auto: no
  source: track
  count: 3
  canonical: {tree}
  whitelist: {whitelist}
  prefer_specific: yes
  cleanup_existing: yes
  fallback: null
ui:
  color: no
"#,
        library = yaml_scalar(&paths.library_dir),
        db = yaml_scalar(&paths.beets_db),
        tree = yaml_scalar(&paths.genres_tree),
        whitelist = yaml_scalar(&paths.genres_whitelist),
        embed_art = if embed_art { "yes" } else { "no" },
    )
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
    let mut venv_cmd = command(&python.path);
    venv_cmd
        .arg("-m")
        .arg("venv")
        .arg("--clear")
        .arg(&paths.venv_dir);
    run_streamed(app, venv_cmd, "venv creation").await?;

    // Shipped wheels when we have them: numpy alone is most of the download,
    // and the install used to be measured in minutes. `--no-index` also makes
    // this the one step that no longer needs the network.
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
        // requirements.txt is the whole resolved tree, not a wish list — see
        // its header. Resolving instead of obeying it would pull back the two
        // packages we drop on purpose, and on Intel macOS one of them has no
        // wheel left to pull.
        .arg("--no-deps")
        // A missing wheel must fail here, loudly. Without this pip falls back
        // to the source archive and starts a compile the user watches for
        // twenty minutes before it dies on a missing toolchain.
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

#[cfg(test)]
mod tests {
    use super::*;

    fn paths() -> AppPaths {
        let data = PathBuf::from("/data");
        AppPaths {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_import_config: data.join("beets").join("config-import.yaml"),
            beets_db: data.join("beets").join("library.db"),
            library_dir: PathBuf::from("/music/Sonarche"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            tools_dir: data.join("tools"),
            python_archive: data.join("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: data.join("wheels"),
        }
    }

    /// The bug that made every import on Windows fail, from the first build to
    /// the fourth: `directory: "C:\Users\…"`. YAML reads `\` as an escape
    /// introducer inside double quotes, so the path opened with `\U` — the
    /// start of an eight-digit unicode escape — and beets refused to load its
    /// own config. Column 12 of line 1, every single time.
    #[test]
    fn a_windows_path_is_not_read_as_a_yaml_escape() {
        let mut paths = paths();
        paths.library_dir = PathBuf::from(r"C:\Users\pieru\Music\Sonarche");
        paths.beets_db = PathBuf::from(r"C:\Users\pieru\AppData\Roaming\beets\library.db");

        let config = beets_config_yaml(&paths, true);

        assert!(
            config.contains(r"directory: 'C:\Users\pieru\Music\Sonarche'"),
            "{config}"
        );
        // The rule, stated once for the whole file rather than per key: a
        // backslash is a directive between double quotes and a plain character
        // between single ones, so no line may ever hold both. `clutter` keeps
        // its double quotes — there is no path in it.
        for line in config.lines() {
            assert!(
                !(line.contains('\\') && line.contains('"')),
                "a backslash inside double quotes: {line}"
            );
        }
    }

    /// Single quotes have exactly one escape, and a doubled `'` is it. Not a
    /// hypothetical: `C:\Users\O'Brien\Music` is an ordinary Windows path.
    #[test]
    fn an_apostrophe_in_a_path_is_doubled_not_left_to_close_the_scalar() {
        let mut paths = paths();
        paths.library_dir = PathBuf::from(r"C:\Users\O'Brien\Music");

        let config = beets_config_yaml(&paths, true);

        assert!(
            config.contains(r"directory: 'C:\Users\O''Brien\Music'"),
            "{config}"
        );
    }

    /// The one line the two configs may differ on, and the reason the second
    /// file exists at all. A library import bakes the album's own cover into
    /// every track when this is `yes` — measured at 314 MB of duplicated images
    /// in a 1.17 GB library, 88 MB of it in a single 18-track album.
    #[test]
    fn the_import_config_is_the_app_config_with_cover_embedding_off() {
        let app = beets_config_yaml(&paths(), true);
        let import = beets_config_yaml(&paths(), false);

        assert!(app.contains("embedart:\n  auto: yes"), "{app}");
        assert!(import.contains("embedart:\n  auto: no"), "{import}");
        // Nothing else may drift: the import writes into the same library, with
        // the same paths, the same genre tree and the same clutter rules.
        assert_eq!(
            app.replace("auto: yes", "auto: no"),
            import.replace("auto: yes", "auto: no")
        );
    }

    /// Both point at the same library and the same database — the import is a
    /// different way in, not a different shelf.
    #[test]
    fn both_configs_target_the_one_library() {
        for embed_art in [true, false] {
            let config = beets_config_yaml(&paths(), embed_art);
            assert!(config.contains("directory: '/music/Sonarche'"));
            assert!(config.contains("library: '/data/beets/library.db'"));
        }
    }
}
