use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::proc::{command, SYSTEM_TAR};

const MIN_PYTHON: (u64, u64) = (3, 10);

/// Chromaprint's fingerprinter, fetched and checksummed at build time by
/// `scripts/prepare-runtime.mjs`.
const FPCALC_BIN: &str = if cfg!(windows) {
    "fpcalc.exe"
} else {
    "fpcalc"
};

/// Static ffmpeg (same provenance), used to remux fragmented DASH m4a into
/// classic MP4 so Music.app, iOS and CarPlay read real durations.
const FFMPEG_BIN: &str = if cfg!(windows) {
    "ffmpeg.exe"
} else {
    "ffmpeg"
};

/// JavaScript runtime yt-dlp needs to descramble YouTube stream URLs.
const DENO_BIN: &str = if cfg!(windows) { "deno.exe" } else { "deno" };

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

pub struct AppPaths {
    pub venv_dir: PathBuf,
    pub staging_dir: PathBuf,
    pub beets_config: PathBuf,
    /// Library-import variant of the config; see `write_beets_config`.
    pub beets_import_config: PathBuf,
    /// beets' incremental-import state, placed explicitly so a library erase can
    /// delete it (a stale one makes beets skip every folder it has seen).
    pub beets_import_state: PathBuf,
    pub beets_db: PathBuf,
    /// The user-chosen library folder. Beets only sees `music_dir()`.
    pub library_root: PathBuf,
    pub sidecar_main: PathBuf,
    pub requirements: PathBuf,
    /// Bundled base genre tree/whitelist (read-only). The beets config points at
    /// the derived copies in [`Self::genres_dir`].
    pub genres_tree: PathBuf,
    pub genres_whitelist: PathBuf,
    /// User genre placements and the derived tree/whitelist, kept outside the
    /// library so an erase doesn't remove them.
    pub genres_dir: PathBuf,
    pub tools_dir: PathBuf,
    /// The bundled interpreter as an archive; `tar` restores its symlinks and
    /// executable bits.
    pub python_archive: PathBuf,
    pub runtime_dir: PathBuf,
    /// Bundled wheels, so the install needs no network.
    pub wheels_dir: PathBuf,
    /// Read-only (inside the signed `.app` on macOS); copied by [`ensure_fpcalc`].
    pub bundled_fpcalc: PathBuf,
    pub bundled_ffmpeg: PathBuf,
    /// Run in place, never copied (81 MB). See [`deno`].
    pub bundled_deno: PathBuf,
    /// Kept in app data rather than the user's cache folder.
    pub deno_cache_dir: PathBuf,
}

/// The library location when moved off the default.
///
/// Held in managed state because [`AppPaths::resolve`] runs on nearly every
/// command and must not read a file on the async runtime.
#[derive(Default)]
pub struct LibraryRoot(std::sync::RwLock<Option<PathBuf>>);

impl LibraryRoot {
    pub fn get(&self) -> Option<PathBuf> {
        self.0.read().ok().and_then(|guard| guard.clone())
    }

    pub fn set(&self, dir: Option<PathBuf>) {
        if let Ok(mut guard) = self.0.write() {
            *guard = dir;
        }
    }
}

/// `Sonarche` in the platform's music folder, else in app data.
pub fn default_library_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .audio_dir()
        .map(|dir| dir.join(crate::library_layout::FOLDER_NAME))
        .unwrap_or_else(|_| {
            app.path()
                .app_data_dir()
                .map(|dir| dir.join("Library"))
                .unwrap_or_else(|_| PathBuf::from("Library"))
        })
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
        let library_root = app
            .try_state::<LibraryRoot>()
            .and_then(|root| root.get())
            .unwrap_or_else(|| default_library_dir(app));
        Ok(Self {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_import_config: data.join("beets").join("config-import.yaml"),
            beets_import_state: data.join("beets").join("import-state.pickle"),
            beets_db: data.join("beets").join("library.db"),
            library_root,
            sidecar_main: sidecar_dir.join("main.py"),
            requirements: sidecar_dir.join("requirements.txt"),
            genres_tree: sidecar_dir.join("genres-tree.yaml"),
            genres_whitelist: sidecar_dir.join("genres-whitelist.txt"),
            genres_dir: data.join("genres"),
            tools_dir: data.join("tools"),
            python_archive: resource("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: resource("wheels"),
            bundled_fpcalc: resource("tools").join(FPCALC_BIN),
            bundled_ffmpeg: resource("tools").join(FFMPEG_BIN),
            bundled_deno: resource("tools").join(DENO_BIN),
            deno_cache_dir: data.join("deno"),
        })
    }

    /// Bundled base + user placements; named by the beets config, written by the
    /// sidecar.
    pub fn derived_genres_tree(&self) -> PathBuf {
        self.genres_dir.join("genres-tree.yaml")
    }

    pub fn derived_genres_whitelist(&self) -> PathBuf {
        self.genres_dir.join("genres-whitelist.txt")
    }

    /// beets' `directory:`, the only folder the sidecar organizes.
    pub fn music_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::MUSIC_DIR)
    }

    pub fn artwork_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::ARTWORK_DIR)
    }

    /// Indexed by the `artist_images` table.
    pub fn artist_images_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_ARTISTS)
    }

    pub fn playlist_covers_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_PLAYLISTS)
    }

    /// Write-only M3U8 mirror; see `playlists_mirror`.
    pub fn playlists_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::PLAYLISTS_DIR)
    }

    pub fn venv_python(&self) -> PathBuf {
        if cfg!(windows) {
            self.venv_dir.join("Scripts").join("python.exe")
        } else {
            self.venv_dir.join("bin").join("python3")
        }
    }

    /// The unpacked bundled interpreter; absent before setup or in builds
    /// without a bundled runtime. Windows keeps it at the tree root.
    pub fn runtime_python(&self) -> PathBuf {
        let root = self.runtime_dir.join("python");
        if cfg!(windows) {
            root.join("python.exe")
        } else {
            root.join("bin").join("python3")
        }
    }

    pub fn fpcalc(&self) -> PathBuf {
        self.tools_dir.join(FPCALC_BIN)
    }

    pub fn ffmpeg(&self) -> PathBuf {
        self.tools_dir.join(FFMPEG_BIN)
    }
}

/// Copies the bundled fpcalc into the tools dir on first use. A failure only
/// degrades enrichment.
///
/// Fetched at build time rather than at runtime: an unsigned app downloading
/// and running an executable looks like a dropper to antivirus software.
pub async fn ensure_fpcalc(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "fpcalc",
        &paths.bundled_fpcalc,
        &paths.fpcalc(),
        &paths.tools_dir,
    )
    .await
}

pub async fn ensure_ffmpeg(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "ffmpeg",
        &paths.bundled_ffmpeg,
        &paths.ffmpeg(),
        &paths.tools_dir,
    )
    .await
}

/// The bundled deno, if this build has one. `None` means downloads fall back
/// to the single client that needs no JavaScript.
pub async fn deno(paths: &AppPaths) -> Option<PathBuf> {
    tokio::fs::try_exists(&paths.bundled_deno)
        .await
        .unwrap_or(false)
        .then(|| paths.bundled_deno.clone())
}

async fn ensure_tool(name: &str, source: &Path, dest: &Path, tools_dir: &Path) -> AppResult<()> {
    if tokio::fs::try_exists(dest).await.unwrap_or(false) {
        return Ok(());
    }
    if !tokio::fs::try_exists(source).await.unwrap_or(false) {
        return Err(AppError::Setup(format!(
            "{name} is missing from this build (expected {}) — run `npm run prepare:runtime`",
            source.display()
        )));
    }

    tokio::fs::create_dir_all(tools_dir).await?;
    tokio::fs::copy(source, dest).await?;

    // The bundler isn't guaranteed to preserve the executable bit.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(dest, std::fs::Permissions::from_mode(0o755)).await?;
    }

    eprintln!("[tools] {name} ready at {}", dest.display());
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

/// Which way into the library a beets config is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Flavour {
    /// A staged download: one untagged file alone in an empty folder.
    App,
    /// The user's own collection, covers already beside the tracks.
    Import,
}

/// Writes the beets config, read by the CLI importer (`--config`) and by the
/// sidecar (BEETSDIR). Regenerated on every launch.
///
/// Two files, since beets takes a single `--config` with no key overrides.
/// The import flavour differs in:
/// - `embedart: no`: covers already sit beside the tracks; embedding them
///   duplicated ~300 MB on a 1.2 GB library.
/// - `fetchart.sources: filesystem`: an import must not reach the network.
/// - Filing templates with fallbacks, the incremental guard and the repair
///   plugin.
async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    ensure_derived_genre_files(paths).await?;
    write_config_file(paths, &paths.beets_config, Flavour::App).await?;
    write_config_file(paths, &paths.beets_import_config, Flavour::Import).await
}

/// Seeds the derived genre files from the bundled base until the sidecar
/// regenerates them.
async fn ensure_derived_genre_files(paths: &AppPaths) -> AppResult<()> {
    tokio::fs::create_dir_all(&paths.genres_dir).await?;
    for (bundled, derived) in [
        (&paths.genres_tree, paths.derived_genres_tree()),
        (&paths.genres_whitelist, paths.derived_genres_whitelist()),
    ] {
        if !tokio::fs::try_exists(&derived).await.unwrap_or(false) {
            tokio::fs::copy(bundled, &derived).await?;
        }
    }
    Ok(())
}

async fn write_config_file(paths: &AppPaths, target: &Path, flavour: Flavour) -> AppResult<()> {
    tokio::fs::write(target, beets_config_yaml(paths, flavour)).await?;
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

/// A path as a single-quoted YAML scalar.
///
/// Double quotes treat `\` as an escape (`C:\Users` starts a `\U` escape).
/// Single quotes' only escape is a doubled `'`, for paths like `O'Brien`.
fn yaml_scalar(path: &Path) -> String {
    format!("'{}'", path.display().to_string().replace('\'', "''"))
}

/// Import filing templates, rendered by beets in `import_paths_test.py`.
///
/// Fallbacks keep untagged files out of `Music//`, and `%if{$track,…}`
/// drops the `00` prefix. `%ifdef` rather than `%if`: a missing flexible
/// attribute renders as the literal `$symbol`, which `%if` treats as true.
const IMPORT_PATHS: &str = r#"paths:
  default: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
  singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title'
  comp: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
"#;

/// Download filing templates, also rendered in `import_paths_test.py`.
///
/// - `Library/`: verified music, `%aunique{}` separating same-named records.
/// - `Unidentified/`: items carrying the `sonarche_provisional` flag.
///
/// `comp` restates `default` so compilations file under their album artist.
/// It can't be omitted: beets merges defaults key by key, and its own `comp`
/// template is `Compilations/$album`.
const APP_PATHS: &str = r#"paths:
  default: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}%aunique{}/%if{$track,$track ,}$title'
  singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/%if{$artist,$artist,Unknown Artist}/$title'
  comp: 'Library/%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}%aunique{}/%if{$track,$track ,}$title'
"#;

/// Lets a stopped import be relaunched without duplicating files. Import
/// flavour only: staged download folders are always new.
const INCREMENTAL: &str = r#"  incremental: yes
"#;

fn beets_config_yaml(paths: &AppPaths, flavour: Flavour) -> String {
    format!(
        r#"directory: {library}
library: {db}
import:
  move: yes
  write: yes
  quiet_fallback: asis
  # Never offer to resume an interrupted import: the prompt reads stdin, and
  # our beets runs headless on the sidecar's protocol pipe. An interrupted
  # run is retried from the top instead.
  resume: no
  # Staged files are imported untagged by design, so beets' duplicate check
  # can only ever collide blank-vs-blank (enriched items have real tags).
  # `skip` (the quiet default) silently drops every album-batch track after
  # the first one; real re-download duplicates never collide anyway.
  duplicate_action: keep
{incremental}{statefile}# cover-hq.* is the archive Sonarche <= 2.x kept beside beets' cover.jpg;
# nothing writes it anymore, but declaring the leftovers clutter lets beets
# prune a folder where one still lingers after a move or merge.
clutter: ["Thumbs.DB", ".DS_Store", "cover-hq.jpg", "cover-hq.png"]
{path_format}{pluginpath}plugins: musicbrainz fetchart embedart lastgenre{repair_plugin}
musicbrainz:
  genres: yes
fetchart:
  auto: yes
{art_sources}embedart:
  auto: {embed_art}
# auto: no — the import stage never runs lastgenre; enrich calls _get_genre()
# itself. Canonical tree + whitelist are the *derived* files the sidecar
# regenerates from the bundled base plus the user's placements (see
# genre_overrides.py): the stored genre is the most specific tree node
# (count 3, specific first), the browse bucket climbs the same tree.
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
        library = yaml_scalar(&paths.music_dir()),
        db = yaml_scalar(&paths.beets_db),
        tree = yaml_scalar(&paths.derived_genres_tree()),
        whitelist = yaml_scalar(&paths.derived_genres_whitelist()),
        embed_art = if flavour == Flavour::App { "yes" } else { "no" },
        incremental = if flavour == Flavour::Import {
            INCREMENTAL
        } else {
            ""
        },
        // Explicit path, so an erase can find it.
        statefile = if flavour == Flavour::Import {
            format!("statefile: {}\n", yaml_scalar(&paths.beets_import_state))
        } else {
            String::new()
        },
        path_format = if flavour == Flavour::Import {
            IMPORT_PATHS
        } else {
            APP_PATHS
        },
        art_sources = if flavour == Flavour::Import {
            "  sources: filesystem\n"
        } else {
            ""
        },
        // Filename-based tag repairs, for the user's own rips only.
        repair_plugin = if flavour == Flavour::Import {
            " sonarche_import"
        } else {
            ""
        },
        // Entries join the `beetsplug` namespace, so this must be the plugin folder.
        pluginpath = if flavour == Flavour::Import {
            format!(
                "pluginpath: [{}]\n",
                yaml_scalar(
                    &paths
                        .sidecar_main
                        .parent()
                        .unwrap_or(&paths.sidecar_main)
                        .join("beetsplug")
                )
            )
        } else {
            String::new()
        },
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
            beets_import_state: data.join("beets").join("import-state.pickle"),
            beets_db: data.join("beets").join("library.db"),
            library_root: PathBuf::from("/music/Sonarche"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            genres_dir: data.join("genres"),
            tools_dir: data.join("tools"),
            python_archive: data.join("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: data.join("wheels"),
            bundled_fpcalc: data.join("tools").join(FPCALC_BIN),
            bundled_ffmpeg: data.join("tools").join(FFMPEG_BIN),
            bundled_deno: data.join("tools").join(DENO_BIN),
            deno_cache_dir: data.join("deno"),
        }
    }

    #[test]
    fn a_windows_path_is_not_read_as_a_yaml_escape() {
        let mut paths = paths();
        paths.library_root = PathBuf::from(r"C:\Users\pieru\Music\Sonarche");
        paths.beets_db = PathBuf::from(r"C:\Users\pieru\AppData\Roaming\beets\library.db");

        let config = beets_config_yaml(&paths, Flavour::App);

        // `music_dir()` uses the host separator.
        let expected = format!("directory: '{}'", paths.music_dir().display());
        assert!(config.contains(&expected), "{config}");
        // A backslash inside double quotes is an escape: no line may mix the two.
        for line in config.lines() {
            assert!(
                !(line.contains('\\') && line.contains('"')),
                "a backslash inside double quotes: {line}"
            );
        }
    }

    #[test]
    fn an_apostrophe_in_a_path_is_doubled_not_left_to_close_the_scalar() {
        let mut paths = paths();
        paths.library_root = PathBuf::from(r"C:\Users\O'Brien\Music");

        let config = beets_config_yaml(&paths, Flavour::App);

        let expected = format!(
            "directory: '{}'",
            paths.music_dir().display().to_string().replace('\'', "''")
        );
        assert!(expected.contains("O''Brien"), "{expected}");
        assert!(config.contains(&expected), "{config}");
    }

    #[test]
    fn the_import_config_turns_cover_embedding_off() {
        assert!(
            beets_config_yaml(&paths(), Flavour::App).contains("embedart:\n  auto: yes"),
            "the app config embeds"
        );
        assert!(
            beets_config_yaml(&paths(), Flavour::Import).contains("embedart:\n  auto: no"),
            "the import config does not"
        );
    }

    #[test]
    fn only_the_import_config_pins_art_to_the_filesystem() {
        assert!(
            beets_config_yaml(&paths(), Flavour::Import)
                .contains("fetchart:\n  auto: yes\n  sources: filesystem\n"),
            "the import config must not reach a remote art source"
        );
        assert!(
            !beets_config_yaml(&paths(), Flavour::App).contains("sources:"),
            "the app config leaves fetchart's own defaults alone"
        );
    }

    /// The flavours may differ only in their known lines.
    #[test]
    fn the_two_configs_differ_on_nothing_but_the_known_import_settings() {
        let app = beets_config_yaml(&paths(), Flavour::App);
        let import = beets_config_yaml(&paths(), Flavour::Import);

        let strip = |config: &str| {
            config
                .replace("  sources: filesystem\n", "")
                .replace("embedart:\n  auto: yes", "embedart:\n  auto: no")
                .replace(" sonarche_import", "")
                .replace(INCREMENTAL, "")
                .replace(IMPORT_PATHS, "")
                .replace(APP_PATHS, "")
                .lines()
                .filter(|line| !line.starts_with("pluginpath:") && !line.starts_with("statefile:"))
                .collect::<Vec<_>>()
                .join("\n")
        };

        assert_eq!(strip(&app), strip(&import));
    }

    #[test]
    fn only_the_import_config_guards_against_re_importing_and_nameless_folders() {
        let import = beets_config_yaml(&paths(), Flavour::Import);
        let app = beets_config_yaml(&paths(), Flavour::App);

        assert!(import.contains("incremental: yes"));
        assert!(import.contains("Unknown Artist"));
        // Must be where the erase can reach it.
        assert!(import.contains("statefile: '/data/beets/import-state.pickle'"));
        assert!(!app.contains("incremental"));
        assert!(!app.contains("statefile"));
    }

    #[test]
    fn the_app_config_keeps_aunique_and_files_guesses_in_the_zone() {
        let app = beets_config_yaml(&paths(), Flavour::App);
        assert!(app.contains(APP_PATHS), "{app}");
        assert!(app.contains("%aunique{}"), "{app}");
        assert!(app.contains("default: 'Library/"), "{app}");
        // The zone boundary is the provisional flag: imported singles are rowless too.
        assert!(
            app.contains("singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/"),
            "{app}"
        );
        let import = beets_config_yaml(&paths(), Flavour::Import);
        assert!(
            import
                .contains("singleton: '%ifdef{sonarche_provisional,Unidentified,Library/Singles}/"),
            "{import}"
        );
    }

    #[test]
    fn neither_config_files_compilations_on_a_shelf_of_their_own() {
        for flavour in [Flavour::App, Flavour::Import] {
            let config = beets_config_yaml(&paths(), flavour);
            assert!(!config.contains("Compilations/"), "{config}");
            let rule = |key: &str| {
                config
                    .lines()
                    .find_map(|line| line.trim().strip_prefix(key))
                    .map(str::to_string)
                    .unwrap_or_default()
            };
            assert_eq!(rule("comp: "), rule("default: "), "{config}");
            assert!(rule("comp: ").starts_with("'Library/"), "{config}");
        }
    }

    #[test]
    fn only_the_import_config_loads_the_repair_plugin() {
        let import = beets_config_yaml(&paths(), Flavour::Import);
        assert!(import.contains("lastgenre sonarche_import"), "{import}");
        assert!(
            import.contains("pluginpath: ['/data/sidecar/beetsplug']"),
            "{import}"
        );

        let app = beets_config_yaml(&paths(), Flavour::App);
        assert!(!app.contains("sonarche_import"), "{app}");
        assert!(!app.contains("pluginpath"), "{app}");
    }

    #[test]
    fn both_configs_target_the_one_library() {
        for flavour in [Flavour::App, Flavour::Import] {
            let config = beets_config_yaml(&paths(), flavour);
            assert!(config.contains(&format!("directory: '{}'", paths().music_dir().display())));
            assert!(config.contains("library: '/data/beets/library.db'"));
        }
    }
}
