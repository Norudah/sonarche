//! Putting the app back to a known state.
//!
//! Four operations, and the line that matters runs between them: some destroy
//! things the app can rebuild by itself in a few minutes, and one destroys
//! music that exists nowhere else.
//!
//! Shipped to everyone, behind the settings screen's danger zone:
//!
//! * [`erase_data`] — the destructive one. The whole library root (audio
//!   files, playlists' M3U8 mirror, artist and playlist images), the beets
//!   index, staged downloads, the history and its dead predecessors, the
//!   log, every preference. Everything the user put in — except the setup:
//!   the engine, the AcoustID key and the walkthrough flag survive, because
//!   an erase asks for a factory-fresh *library*, not a torn-down app.
//! * [`reinstall_environment`] — the harmless one. The Python environment and
//!   the downloaded tools, which the app rebuilds on the next launch. Named
//!   apart from the one above precisely so the two can never be confused at
//!   the moment of clicking.
//!
//! Dev builds only, for testing:
//!
//! * [`reset_setup`] — the same rebuildable half, but à la carte, so an
//!   onboarding pass can replay without dropping a real AcoustID key.
//! * [`reset_library`] — wipes the music with no confirmation at all.

use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::{AppPaths, LibraryRoot};
use crate::sidecar::SidecarState;
use crate::{preferences, settings};

/// One checkbox each, rather than a single "reset everything": replaying the
/// AcoustID step means dropping the key, but re-testing the install does not —
/// and having to paste a real key back after every run makes the reset useless.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ResetTargets {
    /// The Python virtualenv and everything pip put in it.
    pub venv: bool,
    /// The working copies of fpcalc and ffmpeg. Restored from the bundle on
    /// next use.
    pub tools: bool,
    /// The stored AcoustID key.
    pub api_keys: bool,
    /// Terminal jobs in the download history. In-flight jobs are left alone.
    pub history: bool,
    /// The "walkthrough seen" flag.
    pub onboarding: bool,
}

fn ensure_dev(what: &str) -> AppResult<()> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    Err(AppError::InvalidInput(format!(
        "{what} is only available in dev builds"
    )))
}

/// The directories a set of targets removes.
///
/// Split out from the IO so the guarantee in this module's docs is testable:
/// no combination of targets may ever yield the library directory or the beets
/// database. See the test at the bottom of this file.
fn dirs_to_remove(paths: &AppPaths, targets: &ResetTargets) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if targets.venv {
        dirs.push(paths.venv_dir.clone());
        // The unpacked interpreter goes with it: leaving it behind would skip
        // the extraction step on the replay, which is now part of the install.
        dirs.push(paths.runtime_dir.clone());
    }
    if targets.tools {
        dirs.push(paths.tools_dir.clone());
    }
    dirs
}

/// Wipe the rebuildable half of the install. Everything removed here is
/// recreated by the walkthrough; nothing removed here is user data.
pub async fn reset_setup(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
    targets: ResetTargets,
) -> AppResult<()> {
    ensure_dev("setup reset")?;
    let paths = AppPaths::resolve(app)?;

    // Before the files go, not after: the sidecar is a long-lived process
    // running the venv's interpreter. Deleting the venv underneath it leaves it
    // very much alive — Unix keeps a running binary's inode — so the reinstall
    // would finish and the *old* process would still be the one answering, out
    // of a venv that no longer exists. A replay that leaves the previous engine
    // in place is not a replay.
    if targets.venv {
        sidecar.shutdown().await;
        eprintln!("[dev] setup reset: sidecar stopped");
    }

    for dir in dirs_to_remove(&paths, &targets) {
        if tokio::fs::try_exists(&dir).await.unwrap_or(false) {
            tokio::fs::remove_dir_all(&dir).await?;
            eprintln!("[dev] setup reset: removed {}", dir.display());
        }
    }
    if targets.api_keys {
        settings::set("acoustid".into(), String::new()).await?;
        eprintln!("[dev] setup reset: cleared the AcoustID key");
    }
    if targets.history {
        // Through the store rather than by deleting the file: the worker holds
        // an open connection to it for the whole run.
        jobs.clear_history().await;
        eprintln!("[dev] setup reset: cleared the job history");
    }
    if targets.onboarding {
        preferences::set_onboarding_completed(app, false).await?;
        eprintln!("[dev] setup reset: walkthrough will replay");
    }
    Ok(())
}

/// Wipe the whole music library (audio files + beets DB) so bug-fix scenarios
/// restart from a clean slate. The beets zone only: `Artwork/` and the marker
/// are not what a "wipe the music" scenario is about, and the images are
/// precious, not rebuildable.
pub async fn reset_library(app: &AppHandle) -> AppResult<()> {
    ensure_dev("library reset")?;
    let paths = AppPaths::resolve(app)?;
    let music_dir = paths.music_dir();
    if tokio::fs::try_exists(&music_dir).await.unwrap_or(false) {
        tokio::fs::remove_dir_all(&music_dir).await?;
    }
    tokio::fs::create_dir_all(&music_dir).await?;
    let _ = tokio::fs::remove_file(&paths.beets_db).await;
    // With it, always: it lists the source folders beets has taken on, and a
    // library that no longer holds them must not keep skipping them.
    let _ = tokio::fs::remove_file(&paths.beets_import_state).await;
    // The playlist rows survive — they are not the beets zone — but every id
    // in them just stopped resolving, so the mirror empties out with the
    // library rather than pointing at files that are gone.
    crate::playlists_mirror::sync_after_library_change(app).await;
    eprintln!("[dev] library reset: files and beets DB wiped");
    Ok(())
}

/// Everything a full data erase removes, as paths.
///
/// Split out from the IO for the same reason as [`dirs_to_remove`]: this is the
/// list nobody may get wrong, and a test can read it without a filesystem. The
/// venv, the runtime and the tools are deliberately absent — a user asking to
/// forget their library has not asked to re-download a Python.
///
/// `data_dir` is the app-data folder, for the store's dead predecessors: the
/// history shipped as `jobs.json`, then briefly as `jobs.db`, and both
/// migrations leave their source behind on purpose (a migration that deletes
/// its input cannot be retried). An erase is exactly where those copies of the
/// user's history must stop surviving.
fn user_data_to_remove(paths: &AppPaths, data_dir: &Path) -> Vec<PathBuf> {
    let mut targets = vec![
        // The whole root: music, playlists, artwork and the marker go
        // together — a new identity is minted when the folder is recreated,
        // because an erased library is a different library.
        paths.library_root.clone(),
        paths.beets_db.clone(),
        // The incremental guard's memory. It travels with the database it is
        // about — kept, it would make the next import of a once-seen folder do
        // nothing at all, on an app with an empty library.
        paths.beets_import_state.clone(),
        // Staged downloads: audio that never finished its import is still the
        // user's data, and an erase that left it would keep actual music.
        paths.staging_dir.clone(),
    ];
    for legacy in [
        "jobs.json",
        "jobs.json.migrated",
        "jobs.db",
        "jobs.db-shm",
        "jobs.db-wal",
    ] {
        targets.push(data_dir.join(legacy));
    }
    targets
}

/// Wipe everything the user put in: the music, the index, the history, the
/// preferences. Keeps the setup — the engine, the AcoustID key, the
/// walkthrough flag — so the erased app is usable the moment it reopens.
///
/// Refuses while work is in flight rather than deleting a folder something is
/// writing into — the same rule as a library move, for the same reason.
pub async fn erase_data(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
) -> AppResult<()> {
    if jobs.list().await.iter().any(|job| {
        matches!(
            job.status,
            crate::jobs::JobStatus::Queued
                | crate::jobs::JobStatus::Downloading
                | crate::jobs::JobStatus::Importing
                | crate::jobs::JobStatus::Enriching
        )
    }) {
        return Err(AppError::InvalidInput(
            "there is still work in progress".into(),
        ));
    }
    // The download check above cannot see a library import — it is not a job.
    // Erasing mid-import would delete the folder beets is copying into, file
    // by file, while it copies.
    if app
        .state::<crate::library_import::LibraryImportState>()
        .is_running()
        .await
    {
        return Err(AppError::InvalidInput("an import is still running".into()));
    }

    let paths = AppPaths::resolve(app)?;
    let data_dir = app.path().app_data_dir()?;

    // Both hold the files open, and on Windows an open file cannot be removed.
    // The player call goes through `off_runtime` like every other one: `stop`
    // waits on the audio thread's mutex.
    crate::player::off_runtime(app.clone(), |player| player.stop()).await?;
    sidecar.shutdown().await;

    for path in user_data_to_remove(&paths, &data_dir) {
        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            if path.is_dir() {
                tokio::fs::remove_dir_all(&path).await?;
            } else {
                tokio::fs::remove_file(&path).await?;
            }
        }
    }
    // Emptied, not left gone: the download worker assumes the staging folder
    // exists, and the next download must not be the thing that finds out.
    tokio::fs::create_dir_all(&paths.staging_dir).await?;

    jobs.clear_history().await;
    // The files went with the directory above; the index rows go here.
    if let Err(err) = jobs.clear_artist_images().await {
        eprintln!("[reset] artist image index not cleared: {err}");
    }
    // Playlists are lists of item ids that just ceased to exist: rows only.
    if let Err(err) = jobs.clear_playlists().await {
        eprintln!("[reset] playlists not cleared: {err}");
    }

    // The AcoustID key is deliberately spared. It is not data *about* the
    // library — it is the user's credential, tedious to obtain, and erasing it
    // silently re-opened the walkthrough at the key step: an erase should
    // yield a factory-fresh library in a still-set-up app.
    //
    // The preferences file goes wholesale, so the library location goes with
    // it: an erased app opens at its default folder, not at the external disk
    // whose contents it just deleted. The walkthrough flag is put back below —
    // same reasoning as the key, the setup survives the erase.
    let (was_set_up, tour_seen) = preferences::load(app)
        .await
        .map(|prefs| (prefs.onboarding_completed, prefs.home_tour_seen))
        .unwrap_or((false, false));
    let prefs_path = app.path().app_data_dir()?.join("preferences.json");
    let _ = tokio::fs::remove_file(&prefs_path).await;
    app.state::<LibraryRoot>().set(None);
    if was_set_up {
        preferences::set_onboarding_completed(app, true).await?;
    }
    // Same side of the line as the walkthrough flag: the guided tour is part
    // of the setup, not of the library the user just asked to forget.
    if tour_seen {
        preferences::set_home_tour_seen(app, true).await?;
    }

    // Recreate the (now default) library folder so the next launch has
    // somewhere to import into — full layout, fresh marker.
    let paths = AppPaths::resolve(app)?;
    let root = paths.library_root.clone();
    tauri::async_runtime::spawn_blocking(move || crate::library_layout::ensure_layout(&root))
        .await
        .map_err(|err| AppError::Setup(format!("layout task panicked: {err}")))??;

    // The log went last: its lines name tracks and folders, and the erase's
    // own receipt below becomes the fresh file's first line.
    crate::logs::clear(app);
    crate::logs::write("[reset] user data erased");
    Ok(())
}

/// Throw away the Python environment and the downloaded tools. Touches nothing
/// the user owns; the next launch rebuilds it.
pub async fn reinstall_environment(app: &AppHandle, sidecar: &SidecarState) -> AppResult<()> {
    let paths = AppPaths::resolve(app)?;

    // Before the files go: the sidecar is running the venv's own interpreter,
    // and Unix keeps a running binary's inode alive. Delete underneath it and
    // the reinstall finishes while the *old* process is still the one
    // answering, out of a venv that no longer exists.
    sidecar.shutdown().await;

    for dir in [&paths.venv_dir, &paths.runtime_dir, &paths.tools_dir] {
        if tokio::fs::try_exists(dir).await.unwrap_or(false) {
            tokio::fs::remove_dir_all(dir).await?;
        }
    }
    // The walkthrough is what puts the engine back, so it has to run again.
    preferences::set_onboarding_completed(app, false).await?;

    crate::logs::write("[reset] environment removed, the walkthrough will rebuild it");
    Ok(())
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
            beets_import_state: data.join("beets").join("import-state.pickle"),
            library_root: PathBuf::from("/music/Sonarche"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            genres_dir: data.join("genres"),
            tools_dir: data.join("tools"),
            python_archive: data.join("resources").join("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: data.join("resources").join("wheels"),
            bundled_fpcalc: data.join("resources").join("tools").join("fpcalc"),
            bundled_ffmpeg: data.join("resources").join("tools").join("ffmpeg"),
        }
    }

    /// The whole point of the setup reset: it is safe to run with a library you
    /// care about. Enumerates every target combination, not a happy path.
    #[test]
    fn no_target_combination_ever_removes_user_data() {
        let paths = paths();
        for bits in 0u8..32 {
            let targets = ResetTargets {
                venv: bits & 1 != 0,
                tools: bits & 2 != 0,
                api_keys: bits & 4 != 0,
                history: bits & 8 != 0,
                onboarding: bits & 16 != 0,
            };
            for dir in dirs_to_remove(&paths, &targets) {
                assert!(!paths.library_root.starts_with(&dir), "{targets:?}");
                assert!(!paths.beets_db.starts_with(&dir), "{targets:?}");
                assert!(!paths.artist_images_dir().starts_with(&dir), "{targets:?}");
            }
        }
    }

    /// The two user-facing resets have to stay on opposite sides of the one
    /// line that matters. Asserted as sets rather than by reading the code:
    /// the day someone adds the venv to the erase list to "make it thorough",
    /// this is what says no.
    #[test]
    fn erasing_data_and_reinstalling_the_engine_touch_nothing_in_common() {
        let paths = paths();
        let data = user_data_to_remove(&paths, &PathBuf::from("/data"));
        let engine = [&paths.venv_dir, &paths.runtime_dir, &paths.tools_dir];

        for user_path in &data {
            for engine_path in engine {
                assert!(!user_path.starts_with(engine_path), "{user_path:?}");
                assert!(!engine_path.starts_with(user_path), "{engine_path:?}");
            }
        }
    }

    /// The erase is the only operation allowed to reach the music, and it must
    /// actually reach both halves of it — the files and the index. A reset that
    /// dropped the database and left 60 GB of audio behind would look like it
    /// worked and quietly keep the disk full.
    #[test]
    fn erasing_data_takes_the_files_and_the_index_together() {
        let paths = paths();
        let data_dir = PathBuf::from("/data");
        let removed = user_data_to_remove(&paths, &data_dir);

        assert!(removed.contains(&paths.library_root));
        assert!(removed.contains(&paths.beets_db));
        // Images, playlists' M3U8 mirror: all under the root, gone with it.
        assert!(removed
            .iter()
            .any(|path| paths.artist_images_dir().starts_with(path)));
        // Staged downloads are the user's audio too.
        assert!(removed.contains(&paths.staging_dir));
        // The store's dead predecessors hold copies of the history.
        for legacy in ["jobs.json", "jobs.json.migrated", "jobs.db"] {
            assert!(removed.contains(&data_dir.join(legacy)), "{legacy}");
        }
    }

    /// The live store keeps an open connection for the whole run; it is
    /// emptied through queries, never file-deleted. The day someone adds it
    /// to the removal list "to be thorough", this is what says no.
    #[test]
    fn the_erase_never_file_deletes_the_live_store() {
        let data_dir = PathBuf::from("/data");
        let removed = user_data_to_remove(&paths(), &data_dir);

        for suffix in ["sonarche.db", "sonarche.db-shm", "sonarche.db-wal"] {
            assert!(!removed.contains(&data_dir.join(suffix)), "{suffix}");
        }
    }

    #[test]
    fn each_directory_target_removes_its_own_directory() {
        let paths = paths();
        let venv = ResetTargets {
            venv: true,
            ..Default::default()
        };
        assert_eq!(
            dirs_to_remove(&paths, &venv),
            vec![paths.venv_dir.clone(), paths.runtime_dir.clone()]
        );

        let tools = ResetTargets {
            tools: true,
            ..Default::default()
        };
        assert_eq!(
            dirs_to_remove(&paths, &tools),
            vec![paths.tools_dir.clone()]
        );

        assert!(dirs_to_remove(&paths, &ResetTargets::default()).is_empty());
    }
}
