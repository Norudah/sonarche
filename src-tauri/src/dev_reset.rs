//! Dev-build reset helpers, so a bug-fix or an onboarding pass can restart from
//! a known state.
//!
//! Two resets that must never be confused, which is why they live side by side
//! here rather than being one command with a flag:
//!
//! * [`reset_setup`] puts back only what the app can rebuild by itself — the
//!   venv, the downloaded tools, the walkthrough flag, the stored key. **It
//!   never touches the beets database or the audio files.**
//! * [`reset_library`] is the destructive one: it deletes the music.

use std::path::PathBuf;

use serde::Deserialize;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::jobs::JobsState;
use crate::python_env::AppPaths;
use crate::{preferences, settings};

/// One checkbox each, rather than a single "reset everything": replaying the
/// AcoustID step means dropping the key, but re-testing the install does not —
/// and having to paste a real key back after every run makes the reset useless.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ResetTargets {
    /// The Python virtualenv and everything pip put in it.
    pub venv: bool,
    /// Downloaded binaries (fpcalc).
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
    targets: ResetTargets,
) -> AppResult<()> {
    ensure_dev("setup reset")?;
    let paths = AppPaths::resolve(app)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    fn paths() -> AppPaths {
        let data = PathBuf::from("/data");
        AppPaths {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_db: data.join("beets").join("library.db"),
            library_dir: PathBuf::from("/music/Sonarche"),
            sidecar_main: data.join("sidecar").join("main.py"),
            requirements: data.join("sidecar").join("requirements.txt"),
            genres_tree: data.join("sidecar").join("genres-tree.yaml"),
            genres_whitelist: data.join("sidecar").join("genres-whitelist.txt"),
            tools_dir: data.join("tools"),
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
            }
        }
    }

    #[test]
    fn each_directory_target_removes_its_own_directory() {
        let paths = paths();
        let venv = ResetTargets {
            venv: true,
            ..Default::default()
        };
        assert_eq!(dirs_to_remove(&paths, &venv), vec![paths.venv_dir.clone()]);

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
