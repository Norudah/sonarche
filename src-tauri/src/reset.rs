//! Putting the app back to a known state.
//!
//! Four operations, and the line that matters runs between them: some destroy
//! things the app can rebuild by itself in a few minutes, and one destroys
//! music that exists nowhere else.
//!
//! Shipped to everyone, behind the settings screen's danger zone:
//!
//! * [`erase_data`] — the destructive one. Audio files, the beets index, the
//!   download history, the stored key, every preference. Everything the user
//!   put in, and nothing the app can put back.
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

use std::path::PathBuf;

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
    /// The working copy of fpcalc. Restored from the bundle on next use.
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
/// restart from a clean slate.
pub async fn reset_library(app: &AppHandle) -> AppResult<()> {
    ensure_dev("library reset")?;
    let paths = AppPaths::resolve(app)?;
    if tokio::fs::try_exists(&paths.library_dir)
        .await
        .unwrap_or(false)
    {
        tokio::fs::remove_dir_all(&paths.library_dir).await?;
    }
    tokio::fs::create_dir_all(&paths.library_dir).await?;
    let _ = tokio::fs::remove_file(&paths.beets_db).await;
    eprintln!("[dev] library reset: files and beets DB wiped");
    Ok(())
}

/// Everything a full data erase removes, as paths.
///
/// Split out from the IO for the same reason as [`dirs_to_remove`]: this is the
/// list nobody may get wrong, and a test can read it without a filesystem. The
/// venv, the runtime and the tools are deliberately absent — a user asking to
/// forget their library has not asked to re-download a Python.
fn user_data_to_remove(paths: &AppPaths) -> Vec<PathBuf> {
    vec![
        paths.library_dir.clone(),
        paths.beets_db.clone(),
        // User-chosen artist images: they are about this library's artists,
        // and "forget everything I put in" includes them. The setup resets
        // never touch them — they are precious, not rebuildable.
        paths.artist_images_dir.clone(),
    ]
}

/// Wipe everything the user put in: the music, the index, the history, the
/// key, the preferences. Keeps the engine, which is not theirs and costs a
/// download to put back.
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

    let paths = AppPaths::resolve(app)?;

    // Both hold the files open, and on Windows an open file cannot be removed.
    // The player call goes through `off_runtime` like every other one: `stop`
    // waits on the audio thread's mutex.
    crate::player::off_runtime(app.clone(), |player| player.stop()).await?;
    sidecar.shutdown().await;

    for path in user_data_to_remove(&paths) {
        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            if path.is_dir() {
                tokio::fs::remove_dir_all(&path).await?;
            } else {
                tokio::fs::remove_file(&path).await?;
            }
        }
    }

    jobs.clear_history().await;
    // The files went with the directory above; the index rows go here.
    if let Err(err) = jobs.clear_artist_images().await {
        eprintln!("[reset] artist image index not cleared: {err}");
    }
    // Playlists are lists of item ids that just ceased to exist: rows only.
    if let Err(err) = jobs.clear_playlists().await {
        eprintln!("[reset] playlists not cleared: {err}");
    }
    settings::set("acoustid".into(), String::new()).await?;

    // The preferences file last and wholesale, so the library location goes
    // with it: an erased app opens at its default folder, not at the external
    // disk whose contents it just deleted.
    let prefs_path = app.path().app_data_dir()?.join("preferences.json");
    let _ = tokio::fs::remove_file(&prefs_path).await;
    app.state::<LibraryRoot>().set(None);

    // Recreate the (now default) library folder so the next launch has
    // somewhere to import into.
    let paths = AppPaths::resolve(app)?;
    tokio::fs::create_dir_all(&paths.library_dir).await?;

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
            library_dir: PathBuf::from("/music/Sonarche"),
            artist_images_dir: data.join("artists"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            tools_dir: data.join("tools"),
            python_archive: data.join("resources").join("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: data.join("resources").join("wheels"),
            bundled_fpcalc: data.join("resources").join("tools").join("fpcalc"),
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
                assert!(!paths.library_dir.starts_with(&dir), "{targets:?}");
                assert!(!paths.beets_db.starts_with(&dir), "{targets:?}");
                assert!(!paths.artist_images_dir.starts_with(&dir), "{targets:?}");
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
        let data = user_data_to_remove(&paths);
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
        let removed = user_data_to_remove(&paths);

        assert!(removed.contains(&paths.library_dir));
        assert!(removed.contains(&paths.beets_db));
        assert!(removed.contains(&paths.artist_images_dir));
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
