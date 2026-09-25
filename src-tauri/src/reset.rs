//! Resetting the app to a known state.
//!
//! User-facing (settings danger zone):
//! * [`erase_data`]: all user data (library root, beets index, staging,
//!   history, log, preferences). The setup survives: engine, AcoustID key,
//!   walkthrough flag.
//! * [`erase_library`], [`erase_artist_images`], [`erase_playlists`]: one
//!   store at a time, so resetting the music keeps hand-placed images.
//! * [`reinstall_environment`]: the Python environment and tools, which the
//!   app rebuilds. Touches no user data.
//!
//! Dev builds only:
//! * [`reset_setup`]: the rebuildable parts, à la carte.
//! * [`reset_library`]: wipes the music without confirmation.

use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::{AppPaths, LibraryRoot};
use crate::sidecar::SidecarState;
use crate::{preferences, settings};

/// Separate flags so replaying one step (e.g. the install) doesn't drop the
/// AcoustID key.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ResetTargets {
    pub venv: bool,
    /// Working copies of fpcalc and ffmpeg, restored from the bundle.
    pub tools: bool,
    pub api_keys: bool,
    /// Finished jobs only.
    pub history: bool,
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

/// Pure, so the tests can prove no combination reaches the library or the
/// beets database.
fn dirs_to_remove(paths: &AppPaths, targets: &ResetTargets) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if targets.venv {
        dirs.push(paths.venv_dir.clone());
        // Otherwise the replay would skip extraction.
        dirs.push(paths.runtime_dir.clone());
    }
    if targets.tools {
        dirs.push(paths.tools_dir.clone());
        // deno itself is a read-only resource; only its cache lives in app data.
        dirs.push(paths.deno_cache_dir.clone());
    }
    dirs
}

/// Removes the rebuildable half of the install. No user data.
pub async fn reset_setup(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
    targets: ResetTargets,
) -> AppResult<()> {
    ensure_dev("setup reset")?;
    let paths = AppPaths::resolve(app)?;

    // Stop the sidecar first: a running process keeps its deleted interpreter
    // alive on Unix, and would keep answering after the reinstall.
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
        settings::set(app, "acoustid".into(), String::new()).await?;
        eprintln!("[dev] setup reset: cleared the AcoustID key");
    }
    if targets.history {
        // Through queries: the worker keeps the DB open.
        jobs.clear_history().await;
        eprintln!("[dev] setup reset: cleared the job history");
    }
    if targets.onboarding {
        preferences::set_onboarding_completed(app, false).await?;
        eprintln!("[dev] setup reset: walkthrough will replay");
    }
    Ok(())
}

/// Wipes the beets zone (audio + DB). `Artwork/` and the marker stay.
pub async fn reset_library(app: &AppHandle) -> AppResult<()> {
    ensure_dev("library reset")?;
    let paths = AppPaths::resolve(app)?;
    let music_dir = paths.music_dir();
    if tokio::fs::try_exists(&music_dir).await.unwrap_or(false) {
        tokio::fs::remove_dir_all(&music_dir).await?;
    }
    tokio::fs::create_dir_all(&music_dir).await?;
    let _ = tokio::fs::remove_file(&paths.beets_db).await;
    // Its folder list would make beets skip re-imports.
    let _ = tokio::fs::remove_file(&paths.beets_import_state).await;
    // Playlist rows survive but their ids no longer resolve.
    crate::playlists_mirror::sync_after_library_change(app).await;
    eprintln!("[dev] library reset: files and beets DB wiped");
    Ok(())
}

/// Refuses while a download or library import is writing. Imports aren't
/// jobs, hence the second check.
async fn ensure_idle(app: &AppHandle, jobs: &JobsState) -> AppResult<()> {
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
    if app
        .state::<crate::library_import::LibraryImportState>()
        .is_running()
        .await
    {
        return Err(AppError::InvalidInput("an import is still running".into()));
    }
    Ok(())
}

/// Everything a full erase removes. Pure, for the tests.
///
/// The venv, runtime and tools are kept. `data_dir` covers the legacy
/// history files (`jobs.json`, then `jobs.db`) that migrations leave behind.
fn user_data_to_remove(paths: &AppPaths, data_dir: &Path) -> Vec<PathBuf> {
    let mut targets = vec![
        // The whole root; a new identity is minted when it's recreated.
        paths.library_root.clone(),
        paths.beets_db.clone(),
        // Kept, it would make re-imports of seen folders do nothing.
        paths.beets_import_state.clone(),
        // Unimported downloads are user audio too.
        paths.staging_dir.clone(),
        // The remux watermark counts beets ids, which restart at 1.
        data_dir.join("remux-checked"),
    ];
    // Every generation of relayout markers.
    for marker in crate::remux::LAYOUT_MARKERS {
        targets.push(data_dir.join(marker));
    }
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

/// Erases all user data but keeps the setup (engine, AcoustID key,
/// walkthrough flag). Refused while work is running.
pub async fn erase_data(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
) -> AppResult<()> {
    ensure_idle(app, jobs).await?;

    let paths = AppPaths::resolve(app)?;
    let data_dir = app.path().app_data_dir()?;

    // Both hold files open, which Windows can't delete.
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
    // The download worker expects it to exist.
    tokio::fs::create_dir_all(&paths.staging_dir).await?;

    jobs.clear_history().await;
    if let Err(err) = jobs.clear_artist_images().await {
        eprintln!("[reset] artist image index not cleared: {err}");
    }
    if let Err(err) = jobs.clear_playlists().await {
        eprintln!("[reset] playlists not cleared: {err}");
    }

    // The AcoustID key is a credential, not library data: it's kept. The
    // preferences file goes (resetting the library location to the default),
    // and the setup flags are restored below.
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
    if tour_seen {
        preferences::set_home_tour_seen(app, true).await?;
    }

    // Recreate the default library folder with a fresh marker.
    let paths = AppPaths::resolve(app)?;
    let root = paths.library_root.clone();
    tauri::async_runtime::spawn_blocking(move || crate::library_layout::ensure_layout(&root))
        .await
        .map_err(|err| AppError::Setup(format!("layout task panicked: {err}")))??;

    // Last: the log names tracks; the erase receipt starts the new file.
    crate::logs::clear(app);
    crate::logs::write("[reset] user data erased");
    Ok(())
}

/// What a library-only erase removes: the beets zone and caches keyed on its
/// ids. Never `Artwork/`, playlists or histories. Pure, for the tests.
fn library_data_to_remove(paths: &AppPaths, data_dir: &Path) -> Vec<PathBuf> {
    vec![
        paths.music_dir(),
        paths.beets_db.clone(),
        paths.beets_import_state.clone(),
        data_dir.join("remux-checked"),
    ]
    .into_iter()
    .chain(
        crate::remux::LAYOUT_MARKERS
            .iter()
            .map(|marker| data_dir.join(marker)),
    )
    .collect()
}

/// Erases the music and its index only; images, playlist names, histories and
/// preferences stay. Same guards as the full erase.
pub async fn erase_library(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
) -> AppResult<()> {
    ensure_idle(app, jobs).await?;

    let paths = AppPaths::resolve(app)?;
    let data_dir = app.path().app_data_dir()?;

    // Both hold files open, which Windows can't delete.
    crate::player::off_runtime(app.clone(), |player| player.stop()).await?;
    sidecar.shutdown().await;

    for path in library_data_to_remove(&paths, &data_dir) {
        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            if path.is_dir() {
                tokio::fs::remove_dir_all(&path).await?;
            } else {
                tokio::fs::remove_file(&path).await?;
            }
        }
    }
    tokio::fs::create_dir_all(paths.music_dir()).await?;

    // New beets ids restart at 1, so memberships must go.
    if let Err(err) = jobs.clear_playlist_memberships().await {
        eprintln!("[reset] playlist memberships not cleared: {err}");
    }
    crate::playlists_mirror::sync_after_library_change(app).await;

    crate::logs::write("[reset] library erased: audio files and beets index");
    Ok(())
}

/// Removes every artist image (files and rows).
pub async fn erase_artist_images(app: &AppHandle, jobs: &JobsState) -> AppResult<()> {
    let dir = AppPaths::resolve(app)?.artist_images_dir();
    if tokio::fs::try_exists(&dir).await.unwrap_or(false) {
        tokio::fs::remove_dir_all(&dir).await?;
    }
    tokio::fs::create_dir_all(&dir).await?;
    jobs.clear_artist_images().await?;

    crate::logs::write("[reset] artist images erased");
    Ok(())
}

/// Deletes every playlist (favorites comes back empty), covers and mirror.
pub async fn erase_playlists(app: &AppHandle, jobs: &JobsState) -> AppResult<()> {
    let covers_dir = AppPaths::resolve(app)?.playlist_covers_dir();
    if tokio::fs::try_exists(&covers_dir).await.unwrap_or(false) {
        tokio::fs::remove_dir_all(&covers_dir).await?;
    }
    tokio::fs::create_dir_all(&covers_dir).await?;
    jobs.clear_playlists().await?;
    crate::playlists_mirror::sync(app, jobs).await;

    crate::logs::write("[reset] playlists erased");
    Ok(())
}

/// Removes the Python environment and tools; the next launch rebuilds them.
pub async fn reinstall_environment(app: &AppHandle, sidecar: &SidecarState) -> AppResult<()> {
    let paths = AppPaths::resolve(app)?;

    // Stop the sidecar first (see `reset_setup`).
    sidecar.shutdown().await;

    for dir in [
        &paths.venv_dir,
        &paths.runtime_dir,
        &paths.tools_dir,
        &paths.deno_cache_dir,
    ] {
        if tokio::fs::try_exists(dir).await.unwrap_or(false) {
            tokio::fs::remove_dir_all(dir).await?;
        }
    }
    // The walkthrough flag stays: the missing venv reopens the setup step as a
    // repair, not a first run.

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
            bundled_deno: data.join("resources").join("tools").join("deno"),
            deno_cache_dir: data.join("deno"),
        }
    }

    /// Every target combination spares the library.
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

    /// The data erase and the environment reinstall never overlap.
    #[test]
    fn erasing_data_and_reinstalling_the_engine_touch_nothing_in_common() {
        let paths = paths();
        let data = user_data_to_remove(&paths, &PathBuf::from("/data"));
        let engine = [
            &paths.venv_dir,
            &paths.runtime_dir,
            &paths.tools_dir,
            &paths.deno_cache_dir,
        ];

        for user_path in &data {
            for engine_path in engine {
                assert!(!user_path.starts_with(engine_path), "{user_path:?}");
                assert!(!engine_path.starts_with(user_path), "{engine_path:?}");
            }
        }
    }

    /// The erase reaches both the files and the index.
    #[test]
    fn erasing_data_takes_the_files_and_the_index_together() {
        let paths = paths();
        let data_dir = PathBuf::from("/data");
        let removed = user_data_to_remove(&paths, &data_dir);

        assert!(removed.contains(&paths.library_root));
        assert!(removed.contains(&paths.beets_db));
        assert!(removed
            .iter()
            .any(|path| paths.artist_images_dir().starts_with(path)));
        assert!(removed.contains(&paths.staging_dir));
        for legacy in ["jobs.json", "jobs.json.migrated", "jobs.db"] {
            assert!(removed.contains(&data_dir.join(legacy)), "{legacy}");
        }
    }

    /// The live store is emptied through queries, never deleted as a file.
    #[test]
    fn the_erase_never_file_deletes_the_live_store() {
        let data_dir = PathBuf::from("/data");
        let removed = user_data_to_remove(&paths(), &data_dir);

        for suffix in ["sonarche.db", "sonarche.db-shm", "sonarche.db-wal"] {
            assert!(!removed.contains(&data_dir.join(suffix)), "{suffix}");
        }
    }

    /// The library erase covers the beets zone and nothing above it.
    #[test]
    fn the_library_erase_spares_everything_that_is_not_the_beets_zone() {
        let paths = paths();
        let data_dir = PathBuf::from("/data");
        let removed = library_data_to_remove(&paths, &data_dir);

        assert!(removed.contains(&paths.music_dir()));
        assert!(removed.contains(&paths.beets_db));
        assert!(removed.contains(&paths.beets_import_state));
        assert!(removed.contains(&data_dir.join("remux-checked")));

        for path in &removed {
            assert_ne!(path, &paths.library_root, "{path:?}");
            assert!(!paths.artist_images_dir().starts_with(path), "{path:?}");
            assert!(!paths.playlist_covers_dir().starts_with(path), "{path:?}");
            assert!(!path.starts_with(data_dir.join("sonarche.db")), "{path:?}");
            assert_ne!(path, &paths.staging_dir, "{path:?}");
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
            vec![paths.tools_dir.clone(), paths.deno_cache_dir.clone()]
        );

        assert!(dirs_to_remove(&paths, &ResetTargets::default()).is_empty());
    }
}
