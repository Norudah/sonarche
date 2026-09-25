//! Moving the music library to another folder.
//!
//! beets stores paths relative to `directory:` for files under it, so moving
//! the folder and repointing `directory:` is enough: no database rewrite.
//! Items stored with absolute paths live outside the library and are
//! unaffected. The move refuses while work is queued, stops playback and
//! shuts the sidecar down first.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, AppResult};
use crate::jobs::{JobStatus, JobsState};
use crate::preferences;
use crate::python_env::{self, AppPaths, LibraryRoot};
use crate::sidecar::SidecarState;

pub use crate::library_layout::FOLDER_NAME;

/// Why a move can't proceed; the front words each case.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Refusal {
    SameLocation,
    /// The destination is inside the library.
    IntoItself,
    /// The destination is inside app data, which a reset may delete.
    InsideAppData,
    /// A non-empty `Sonarche` folder that isn't ours is already there.
    Occupied,
    NotWritable,
    Busy,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCheck {
    /// The chosen parent plus `Sonarche`.
    pub target: String,
    pub refusal: Option<Refusal>,
    pub file_count: u64,
    pub size_bytes: u64,
    /// Same volume: instant rename. Otherwise every byte is copied.
    pub same_volume: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryLocation {
    pub path: String,
    pub default_path: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveProgress {
    pub copied: u64,
    pub total: u64,
}

/// The refusals that don't need the filesystem, testable in isolation.
pub fn validate_paths(current: &Path, app_data: &Path, target: &Path) -> Option<Refusal> {
    if target == current {
        return Some(Refusal::SameLocation);
    }
    if target.starts_with(current) {
        return Some(Refusal::IntoItself);
    }
    if target.starts_with(app_data) {
        return Some(Refusal::InsideAppData);
    }
    None
}

/// Files and bytes under a directory; `(0, 0)` if missing.
fn measure(dir: &Path) -> (u64, u64) {
    let mut files = 0;
    let mut bytes = 0;
    let mut stack = vec![dir.to_path_buf()];

    while let Some(next) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&next) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_dir() {
                stack.push(entry.path());
            } else if let Ok(meta) = entry.metadata() {
                files += 1;
                bytes += meta.len();
            }
        }
    }
    (files, bytes)
}

/// Unknown counts as different volumes: promising an instant move and then
/// copying is the worse mistake.
fn same_volume(a: &Path, b: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        match (std::fs::metadata(a), std::fs::metadata(b)) {
            (Ok(left), Ok(right)) => left.dev() == right.dev(),
            _ => false,
        }
    }
    #[cfg(not(unix))]
    {
        // No cheap device id on Windows: compare drive prefixes.
        match (a.components().next(), b.components().next()) {
            (Some(left), Some(right)) => left == right,
            _ => false,
        }
    }
}

fn is_empty_dir(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false)
}

async fn any_work_in_flight(jobs: &JobsState) -> bool {
    jobs.list().await.iter().any(|job| {
        matches!(
            job.status,
            JobStatus::Queued
                | JobStatus::Downloading
                | JobStatus::Importing
                | JobStatus::Enriching
        )
    })
}

/// What the confirmation shows, and whether the move is allowed.
pub async fn check(app: &AppHandle, jobs: &JobsState, parent: PathBuf) -> AppResult<MoveCheck> {
    let paths = AppPaths::resolve(app)?;
    let app_data = app.path().app_data_dir()?;
    let current = paths.library_root.clone();
    let busy = any_work_in_flight(jobs).await;

    tauri::async_runtime::spawn_blocking(move || {
        let target = parent.join(FOLDER_NAME);
        let (file_count, size_bytes) = measure(&current);

        let refusal = validate_paths(&current, &app_data, &target)
            .or_else(|| (!parent.is_dir()).then_some(Refusal::NotWritable))
            .or_else(|| (target.exists() && !is_empty_dir(&target)).then_some(Refusal::Occupied))
            .or(busy.then_some(Refusal::Busy));

        Ok(MoveCheck {
            same_volume: same_volume(&current, &parent),
            target: target.display().to_string(),
            refusal,
            file_count,
            size_bytes,
        })
    })
    .await
    .map_err(|err| AppError::Setup(err.to_string()))?
}

/// File-by-file copy with progress, for moves across volumes.
fn copy_tree(
    from: &Path,
    to: &Path,
    total: u64,
    mut on_progress: impl FnMut(u64, u64),
) -> std::io::Result<u64> {
    let mut copied = 0;
    let mut stack = vec![from.to_path_buf()];
    std::fs::create_dir_all(to)?;

    while let Some(next) = stack.pop() {
        for entry in std::fs::read_dir(&next)? {
            let entry = entry?;
            let path = entry.path();
            let relative = path
                .strip_prefix(from)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let destination = to.join(relative);

            if entry.file_type()?.is_dir() {
                std::fs::create_dir_all(&destination)?;
                stack.push(path);
            } else {
                std::fs::copy(&path, &destination)?;
                copied += 1;
                // Throttled: one event per file would flood the channel.
                if copied % 50 == 0 {
                    on_progress(copied, total);
                }
            }
        }
    }
    on_progress(copied, total);
    Ok(copied)
}

/// Performs the move, refusing rather than half-doing it.
pub async fn perform(
    app: &AppHandle,
    jobs: &JobsState,
    sidecar: &SidecarState,
    parent: PathBuf,
) -> AppResult<LibraryLocation> {
    let verdict = check(app, jobs, parent.clone()).await?;
    if let Some(refusal) = verdict.refusal {
        return Err(AppError::InvalidInput(format!(
            "library move refused: {}",
            serde_json::to_string(&refusal)?.trim_matches('"')
        )));
    }

    let paths = AppPaths::resolve(app)?;
    let current = paths.library_root.clone();
    let target = parent.join(FOLDER_NAME);

    // The player holds a file open, which Windows can't move.
    crate::player::off_runtime(app.clone(), |player| player.stop()).await?;
    // The sidecar has beets loaded on the old config; it restarts lazily.
    sidecar.shutdown().await;

    let total = verdict.file_count;
    let handle = app.clone();
    let moved = tauri::async_runtime::spawn_blocking(move || -> std::io::Result<()> {
        if let Some(parent_of_target) = target.parent() {
            std::fs::create_dir_all(parent_of_target)?;
        }
        // Any rename failure (typically cross-volume) falls back to a copy.
        if std::fs::rename(&current, &target).is_ok() {
            let _ = handle.emit(
                "library-move-progress",
                MoveProgress {
                    copied: total,
                    total,
                },
            );
            return Ok(());
        }
        copy_tree(&current, &target, total, |copied, total| {
            let _ = handle.emit("library-move-progress", MoveProgress { copied, total });
        })?;
        std::fs::remove_dir_all(&current)?;
        Ok(())
    })
    .await
    .map_err(|err| AppError::Setup(err.to_string()))?;
    moved?;

    let target = parent.join(FOLDER_NAME);
    preferences::set_library_dir(app, Some(target.clone())).await?;
    app.state::<LibraryRoot>().set(Some(target.clone()));

    // Rewrites `directory:` and widens the asset scope to the new folder.
    python_env::adopt_library_dir(app).await?;

    location(app)
}

pub fn location(app: &AppHandle) -> AppResult<LibraryLocation> {
    let paths = AppPaths::resolve(app)?;
    let default_path = python_env::default_library_dir(app);
    Ok(LibraryLocation {
        is_default: paths.library_root == default_path,
        path: paths.library_root.display().to_string(),
        default_path: default_path.display().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DATA: &str = "/data";
    const CURRENT: &str = "/music/Sonarche";

    fn check(target: &str) -> Option<Refusal> {
        validate_paths(Path::new(CURRENT), Path::new(DATA), Path::new(target))
    }

    #[test]
    fn a_different_volume_is_fine() {
        assert_eq!(check("/Volumes/Backup/Sonarche"), None);
        assert_eq!(check("/music/archive/Sonarche"), None);
    }

    #[test]
    fn moving_where_it_already_is_is_refused() {
        assert_eq!(check(CURRENT), Some(Refusal::SameLocation));
    }

    #[test]
    fn moving_into_the_library_is_refused() {
        assert_eq!(
            check("/music/Sonarche/nested/Sonarche"),
            Some(Refusal::IntoItself)
        );
    }

    /// A library inside app data would be deleted by a reset.
    #[test]
    fn moving_into_app_data_is_refused() {
        assert_eq!(check("/data/Sonarche"), Some(Refusal::InsideAppData));
        assert_eq!(
            check("/data/nested/deep/Sonarche"),
            Some(Refusal::InsideAppData)
        );
    }

    /// `Path::starts_with` compares components, not characters.
    #[test]
    fn a_sibling_with_a_similar_name_is_not_inside() {
        assert_eq!(check("/music/Sonarche-old/Sonarche"), None);
        assert_eq!(check("/data-other/Sonarche"), None);
    }
}
