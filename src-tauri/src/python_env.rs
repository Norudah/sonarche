use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::error::{AppError, AppResult};
use crate::proc::{command, SYSTEM_TAR};

const MIN_PYTHON: (u64, u64) = (3, 10);

/// Chromaprint's fingerprinter, as the build lays it down. Pinned and checksummed
/// in `scripts/prepare-runtime.mjs`, which is the only place that fetches it.
const FPCALC_BIN: &str = if cfg!(windows) {
    "fpcalc.exe"
} else {
    "fpcalc"
};

/// Static ffmpeg, same provenance story as fpcalc. Used for exactly one thing:
/// remuxing YouTube's fragmented DASH m4a into a classic MP4 (`-c copy`) so
/// players that read the classic sample tables — Music.app, iOS, CarPlay —
/// see real durations instead of 0:00.
const FFMPEG_BIN: &str = if cfg!(windows) {
    "ffmpeg.exe"
} else {
    "ffmpeg"
};

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
    /// The variant used only by the library import — cover embedding off, and
    /// no remote art sources. See `write_beets_config` for why the two cannot
    /// be one file.
    pub beets_import_config: PathBuf,
    /// Where beets remembers the directories it has already taken on.
    ///
    /// Named explicitly rather than left to beets' own default, which resolves
    /// beside the config file: this file has to be *deletable by us*, because it
    /// only makes sense next to the library it describes. Wiping the library and
    /// leaving this behind makes beets skip every folder it has ever seen — the
    /// user re-imports and lands "0 dossier · Importé" on an empty app.
    pub beets_import_state: PathBuf,
    pub beets_db: PathBuf,
    /// The folder the user picks — the zones live under it, and the derived
    /// paths below are methods so no copy can drift from it. Beets only ever
    /// sees `music_dir()`; the root is what settings shows and what a move
    /// moves.
    pub library_root: PathBuf,
    pub sidecar_main: PathBuf,
    pub requirements: PathBuf,
    /// The bundled base tree/whitelist, read-only app resources. The beets
    /// config never names them directly anymore — it points at the derived
    /// copies in [`Self::genres_dir`], which fold in the user's placements.
    pub genres_tree: PathBuf,
    pub genres_whitelist: PathBuf,
    /// The user's genre placements and the derived tree/whitelist the sidecar
    /// regenerates from them (see sidecar `genre_overrides.py`). App data,
    /// deliberately outside the beets zone: a placement is an opinion about a
    /// genre name, so erasing the library must not take it along.
    pub genres_dir: PathBuf,
    pub tools_dir: PathBuf,
    /// The interpreter the app ships, still packed. Unpacked at setup rather
    /// than laid out as loose resources: the tree is full of symlinks and
    /// executable bits, and `tar` is the thing that reliably restores both.
    pub python_archive: PathBuf,
    /// Where that archive lands. See `runtime_python` for what sits inside.
    pub runtime_dir: PathBuf,
    /// Wheels shipped alongside, so the install needs no network.
    pub wheels_dir: PathBuf,
    /// The fpcalc the build shipped, before [`ensure_fpcalc`] copies it into
    /// `tools_dir`. Read-only: on macOS it lives inside a signed `.app`.
    pub bundled_fpcalc: PathBuf,
    /// The ffmpeg the build shipped, same lifecycle as `bundled_fpcalc`.
    pub bundled_ffmpeg: PathBuf,
}

/// Where the library lives, when the user has moved it off the default.
///
/// Managed state and not a read of `preferences.json`, because
/// [`AppPaths::resolve`] is synchronous and runs on nearly every command: a
/// file read in there would be blocking IO on the tokio runtime, dozens of
/// times per screen. Seeded once at startup from the preferences file and
/// rewritten only by a move, which is the only thing that changes it.
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

/// The folder the app picks when nobody has said otherwise: a `Sonarche` inside
/// the platform's music folder, falling back to app data on a system that has
/// no such folder.
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
        // The user's choice wins; the default is only what nobody overrode.
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
        })
    }

    /// Derived genre tree (bundled base + user placements) — what the beets
    /// config's `lastgenre.canonical` names. Written by the sidecar.
    pub fn derived_genres_tree(&self) -> PathBuf {
        self.genres_dir.join("genres-tree.yaml")
    }

    pub fn derived_genres_whitelist(&self) -> PathBuf {
        self.genres_dir.join("genres-whitelist.txt")
    }

    /// The beets zone — `directory:`, the only folder the sidecar organizes.
    pub fn music_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::MUSIC_DIR)
    }

    pub fn artwork_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::ARTWORK_DIR)
    }

    /// Artist images, under readable names (an artist has no folder of their
    /// own in the beets zone). Indexed by the `artist_images` table.
    pub fn artist_images_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_ARTISTS)
    }

    /// Playlist tiles, same story: a playlist exists only in sonarche.db, so
    /// its image lives here, named after it.
    pub fn playlist_covers_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_PLAYLISTS)
    }

    /// The M3U8 mirror of the playlists. Written from sonarche.db, never read
    /// back — see `playlists_mirror`.
    pub fn playlists_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::PLAYLISTS_DIR)
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
        self.tools_dir.join(FPCALC_BIN)
    }

    pub fn ffmpeg(&self) -> PathBuf {
        self.tools_dir.join(FFMPEG_BIN)
    }
}

/// Copy the shipped fpcalc into the app-owned tools dir on first use.
/// Self-healing, like the venv: a failure only degrades enrichment, never the
/// app, and a reset that clears `tools_dir` gets it back on the next call.
///
/// It used to be downloaded here instead, checksummed against a pin a few lines
/// up. Both moved to build time — an unsigned binary that pulls an executable
/// off the network and then runs it is indistinguishable from a dropper, and
/// Defender quarantined the Windows installer on exactly that reading. The
/// checksum is no worse off for it: verified on a machine we control, where a
/// mismatch stops a release rather than an app already in someone's hands.
pub async fn ensure_fpcalc(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "fpcalc",
        &paths.bundled_fpcalc,
        &paths.fpcalc(),
        &paths.tools_dir,
    )
    .await
}

/// Same contract as [`ensure_fpcalc`], for the bundled ffmpeg.
pub async fn ensure_ffmpeg(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "ffmpeg",
        &paths.bundled_ffmpeg,
        &paths.ffmpeg(),
        &paths.tools_dir,
    )
    .await
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

    // `copy` carries the mode across, but only if the bundler kept it on the
    // resource in the first place — and a bundler copying files one by one is
    // not guaranteed to. Cheaper to set it than to depend on that chain.
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
        adopt_library_dir(app).await?;
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
        library_dir: paths.library_root.display().to_string(),
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

/// Which of the two ways music enters the library a config is for.
///
/// A flavour rather than a pair of booleans: the two lines that differ both
/// follow from *this* question, and a caller passing `(true, false)` would have
/// to remember which flag meant what.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Flavour {
    /// A staged download: one untagged file alone in an empty folder.
    App,
    /// Someone's own collection, covers already sitting beside the tracks.
    Import,
}

/// Single config site for beets: the CLI importer reads it via `--config` and
/// the sidecar's in-process beets via BEETSDIR. Regenerated on every launch.
///
/// Written twice, differing in two lines, and both differences are about art.
///
/// `embedart: auto` bakes the album's cover into every track. That costs
/// nothing on a download — the staged file is alone in an empty folder when the
/// import stage runs, so there is no art to bake — and is ruinous on a library
/// import, where the cover is already beside the tracks. Measured on a real
/// import: 314 MB of duplicated images across 1.17 GB, one full-size copy per
/// track, 88 MB for a single 18-track album. The interface reads the folder's
/// file and never the tag, so the embedding only ever served other players.
///
/// `fetchart.sources` is pinned to the filesystem for an import, because an
/// import is meant to touch no network at all. `-A` takes MusicBrainz and
/// AcoustID out of the picture, but fetchart runs on its own hook and its
/// default sources include iTunes and Amazon — so a folder whose files already
/// carry an album and artist (a Sonarche library being re-imported, say) had
/// beets quietly searching store artwork mid-copy, and adopting whatever came
/// back as the album's cover. The local file is the only source an import
/// should trust; it is also the only one that can be right about a collection
/// nobody has identified yet.
///
/// Two files rather than a flag on one, because beets takes a single
/// `--config` and offers no way to override a key from the command line.
async fn write_beets_config(paths: &AppPaths) -> AppResult<()> {
    ensure_derived_genre_files(paths).await?;
    write_config_file(paths, &paths.beets_config, Flavour::App).await?;
    write_config_file(paths, &paths.beets_import_config, Flavour::Import).await
}

/// The config above names the derived genre files; make sure something is
/// there before beets ever reads it. A plain copy of the bundled base is
/// enough — the sidecar regenerates the real derived pair (base + the user's
/// placements) at every startup, this only covers the window before its first
/// run and the fresh-install case.
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

/// Make the current library directory the one everything else believes in.
///
/// Two things have to be told, and both are easy to forget separately: beets,
/// through `directory:` in its two configs, and the webview's asset scope,
/// without which every cover in the app 404s behind a path the security layer
/// has never heard of. `tauri.conf.json` can only name the default folder, so
/// a moved library has to be granted at runtime.
///
/// Called after a move, and on every environment check — so a library that was
/// moved while the app was closed, or one whose config was written by an older
/// build, is repaired on the next launch rather than staying half-pointed.
pub async fn adopt_library_dir(app: &AppHandle) -> AppResult<()> {
    let paths = AppPaths::resolve(app)?;
    {
        let root = paths.library_root.clone();
        // Sync fs by design (it also runs from the setup hook); off the
        // runtime here. Zones only — the marker is the migration's claim to
        // make, not a repair pass's.
        tauri::async_runtime::spawn_blocking(move || crate::library_layout::ensure_zones(&root))
            .await
            .map_err(|err| AppError::Setup(format!("layout task panicked: {err}")))??;
    }
    if let Some(parent) = paths.beets_config.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    write_beets_config(&paths).await?;
    // The root, recursively — `Music/` for tracks and covers, `Artwork/` for
    // artist and playlist images; both are served through the asset protocol.
    if let Err(err) = app
        .asset_protocol_scope()
        .allow_directory(&paths.library_root, true)
    {
        // Not fatal: the default folder is already in the manifest's scope, so
        // this only ever matters for a moved library — and a library the user
        // can browse without covers beats an app that refuses to start.
        eprintln!("[library] could not widen the asset scope: {err}");
    }
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

/// Where an imported track is filed.
///
/// Import flavour only, for the same reason the repair plugin is: a staged
/// download has been enriched and has real tags, while someone's own folder may
/// have none at all — and beets' stock template turns an empty artist and album
/// into two empty path components, filing the whole library under `Music//`.
/// Checked against beets' own renderer in `paths_test.py`, which is the side
/// that can actually run it.
///
/// `%if{$track,…}` also drops the number prefix when there is none: beets reads
/// an unset track as falsy, so an untagged rip lands on `Title.mp3` instead of
/// the `00 Title.mp3` a bare `$track $title` produced.
const IMPORT_PATHS: &str = r#"paths:
  default: '%if{$albumartist,$albumartist,Unknown Artist}/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
  singleton: 'Singles/%if{$artist,$artist,Unknown Artist}/$title'
  comp: 'Compilations/%if{$album,$album,Unknown Album}/%if{$track,$track ,}$title'
"#;

/// beets remembers the source directories it has taken on and skips them on a
/// later run. This is the guard behind a stopped import being safe to relaunch:
/// without it a retry re-copies everything that landed before the stop, and
/// `duplicate_action: keep` keeps both copies.
///
/// Import flavour only — every staged download folder is new by construction,
/// and remembering them would grow a list forever.
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
{incremental}{statefile}# cover-hq.* is Sonarche's own file (the full-size CAA art next to beets'
# cover.jpg); declaring it clutter lets beets prune a folder that only has
# it left after an album is moved or merged away.
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
        // Import flavour only. beets remembers the source directories it has
        // taken on and skips them on a later run, which is what makes a
        // re-import — and above all a *retry after a stop* — add nothing twice.
        // Nothing for the download path: every staged folder is new by
        // construction, and remembering them would grow a list forever.
        incremental = if flavour == Flavour::Import {
            INCREMENTAL
        } else {
            ""
        },
        // Spelled out so the erase can find it. beets would otherwise put it
        // beside the config under a name of its own choosing, where nothing
        // that deletes the library would ever think to look.
        statefile = if flavour == Flavour::Import {
            format!("statefile: {}\n", yaml_scalar(&paths.beets_import_state))
        } else {
            String::new()
        },
        path_format = if flavour == Flavour::Import {
            IMPORT_PATHS
        } else {
            ""
        },
        art_sources = if flavour == Flavour::Import {
            "  sources: filesystem\n"
        } else {
            ""
        },
        // `sonarche_import` (sidecar/beetsplug/) fills title/artist/track from
        // the filename when the tag is empty and unpacks YYYYMMDD years —
        // repairs for someone's own rips. The download path must not load it:
        // a staged file's name is the YouTube title, and enrich owns those
        // fields there.
        repair_plugin = if flavour == Flavour::Import {
            " sonarche_import"
        } else {
            ""
        },
        // The entries of `pluginpath` join the `beetsplug` namespace package's
        // own search path, so the directory named here must hold the plugin
        // *files* — pointing at the sidecar root would have beets look for
        // `sidecar/sonarche_import.py`, which is not where it lives.
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
        paths.library_root = PathBuf::from(r"C:\Users\pieru\Music\Sonarche");
        paths.beets_db = PathBuf::from(r"C:\Users\pieru\AppData\Roaming\beets\library.db");

        let config = beets_config_yaml(&paths, Flavour::App);

        // The expected path is derived, not spelled out: `music_dir()` joins
        // with the host separator, so the tail is `\Music` on Windows and
        // `/Music` in this test run.
        let expected = format!("directory: '{}'", paths.music_dir().display());
        assert!(config.contains(&expected), "{config}");
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
        paths.library_root = PathBuf::from(r"C:\Users\O'Brien\Music");

        let config = beets_config_yaml(&paths, Flavour::App);

        let expected = format!(
            "directory: '{}'",
            paths.music_dir().display().to_string().replace('\'', "''")
        );
        assert!(expected.contains("O''Brien"), "{expected}");
        assert!(config.contains(&expected), "{config}");
    }

    /// The reason the second file exists at all. A library import bakes the
    /// album's own cover into every track when this is `yes` — measured at
    /// 314 MB of duplicated images in a 1.17 GB library, 88 MB of it in a
    /// single 18-track album.
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

    /// An import must reach no network. `-A` takes MusicBrainz and AcoustID out
    /// of it, but fetchart runs on its own hook, and its default sources
    /// include iTunes and Amazon — enough for beets to search store artwork
    /// mid-copy on files that already carry an album and artist.
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

    /// The import flavour differs on art, the repair plugin, and the three
    /// things it needs that the download path must not have: a filing template
    /// with fallbacks, and the incremental guard. Everything else has to stay
    /// identical — same library, same genre tree, same clutter rules — so this
    /// strips the known differences and demands the rest match exactly.
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
                .lines()
                .filter(|line| !line.starts_with("pluginpath:") && !line.starts_with("statefile:"))
                .collect::<Vec<_>>()
                .join("\n")
        };

        assert_eq!(strip(&app), strip(&import));
    }

    /// The two guards a re-import depends on, named so a future edit to the
    /// config cannot drop them silently. `incremental` is what makes relaunching
    /// a stopped import safe; the paths are what keep an untagged rip out of
    /// `Music//`.
    #[test]
    fn only_the_import_config_guards_against_re_importing_and_nameless_folders() {
        let import = beets_config_yaml(&paths(), Flavour::Import);
        let app = beets_config_yaml(&paths(), Flavour::App);

        assert!(import.contains("incremental: yes"));
        assert!(import.contains("Unknown Artist"));
        // The guard's memory must be somewhere the erase can reach. beets'
        // default puts it beside the config under a name of its own, where
        // nothing that wipes the library would think to look — and a library
        // wiped while that file survives makes the next import of a once-seen
        // folder do nothing at all.
        assert!(import.contains("statefile: '/data/beets/import-state.pickle'"));
        assert!(!app.contains("incremental"));
        assert!(!app.contains("statefile"));
        assert!(!app.contains("paths:"));
    }

    /// The filename/year repairs are for someone's own rips. On the download
    /// path the filename *is* the YouTube title and enrich owns those fields,
    /// so only the import flavour may load the plugin.
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

    /// Both point at the same library and the same database — the import is a
    /// different way in, not a different shelf.
    #[test]
    fn both_configs_target_the_one_library() {
        for flavour in [Flavour::App, Flavour::Import] {
            let config = beets_config_yaml(&paths(), flavour);
            assert!(config.contains(&format!("directory: '{}'", paths().music_dir().display())));
            assert!(config.contains("library: '/data/beets/library.db'"));
        }
    }
}
