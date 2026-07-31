//! Moving the music library to another folder.
//!
//! Cheaper than it sounds, thanks to one beets detail: since 2.x, beets stores
//! a track's path *relative* to `directory:` whenever the file lives under it
//! (see `beets/dbcore/pathutils.py`, and the note in `sidecar/library.py`).
//! Everything Sonarche imports lands under the library, so every path in the
//! database is relative — which means moving the folder and repointing
//! `directory:` is the whole job. There is no database rewrite, and no window
//! in which the index disagrees with the disk.
//!
//! The rare item stored with an absolute path is one that lives *outside* the
//! library. Moving the library does not touch it, so it keeps working.
//!
//! What does need care is everything holding the old folder open: the player
//! has a file mapped, the sidecar has beets loaded against the old config, and
//! a download in flight is about to write into a directory that is moving. So
//! the move refuses to start while work is queued, stops playback, and takes
//! the sidecar down before the first byte moves.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, AppResult};
use crate::jobs::{JobStatus, JobsState};
use crate::preferences;
use crate::python_env::{self, AppPaths, LibraryRoot};
use crate::sidecar::SidecarState;

/// The folder the library always lives in, inside whatever parent is chosen.
///
/// The picker asks for a parent and we append this, rather than taking the
/// picked folder as the library itself. Two reasons, both about the folder the
/// user did not mean to give us: a stray click on Home would spray an album
/// tree over their home directory, and "remove the library" further down the
/// settings screen would then have a folder full of unrelated things to
/// remove. A named folder is one we can be sure we own.
pub const FOLDER_NAME: &str = "Sonarche";

/// Why a move cannot go ahead. Machine-readable: the frontend turns each into
/// its own sentence, and "invalid path" is not a sentence anyone can act on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Refusal {
    /// The library already lives there.
    SameLocation,
    /// The destination sits inside the library being moved.
    IntoItself,
    /// The destination sits inside the app's own data folder, where a reset is
    /// allowed to delete everything.
    InsideAppData,
    /// A non-empty `Sonarche` folder is already there, and it is not ours.
    Occupied,
    /// The parent is not a directory we can write into.
    NotWritable,
    /// Downloads or an import are running.
    Busy,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCheck {
    /// Where the library would end up: the chosen parent plus `Sonarche`.
    pub target: String,
    /// `None` when the move can go ahead.
    pub refusal: Option<Refusal>,
    pub file_count: u64,
    pub size_bytes: u64,
    /// A rename within one volume is instantaneous; across volumes every byte
    /// is copied, which is the difference between a click and a coffee.
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

/// The one refusal set that does not need the filesystem.
///
/// Split out so the containment rules — the two ways a move eats itself, and
/// the one that hides the library where a reset can reach it — are testable
/// without building a directory tree. See the tests at the bottom.
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

/// Files and bytes under a directory. Returns `(0, 0)` for a path that is not
/// there, which is the honest answer for a library nothing has been added to.
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

/// Whether two paths sit on the same filesystem, which decides whether the move
/// is a rename or a copy. Unknown counts as "not the same": promising an
/// instant move and then copying 40 GB is the worse way to be wrong.
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
        // Windows has no cheap device id through std; the drive letter is the
        // question being asked, and comparing prefixes answers it.
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

/// Everything the confirmation needs to say, and whether there is anything to
/// confirm. Runs the filesystem work off the runtime.
pub async fn check(app: &AppHandle, jobs: &JobsState, parent: PathBuf) -> AppResult<MoveCheck> {
    let paths = AppPaths::resolve(app)?;
    let app_data = app.path().app_data_dir()?;
    let current = paths.library_dir.clone();
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

/// Copy a tree file by file, reporting as it goes. The fallback for a move
/// across volumes, where `rename` cannot help.
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
                // Every fifty, not every file: a 10 000-track library would
                // otherwise spend the move flooding the event channel.
                if copied % 50 == 0 {
                    on_progress(copied, total);
                }
            }
        }
    }
    on_progress(copied, total);
    Ok(copied)
}

/// Do the move. Refuses rather than half-doing it — see the module docs for
/// what has to let go of the old folder first.
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
    let current = paths.library_dir.clone();
    let target = parent.join(FOLDER_NAME);

    // The player first: it holds an open file, and on Windows an open file is
    // a file that cannot be moved. Stopping is not a courtesy here.
    //
    // Through `off_runtime` like every other player call: `stop` waits on the
    // audio thread's mutex, and the runtime's threads are not the ones to wait
    // on it.
    crate::player::off_runtime(app.clone(), |player| player.stop()).await?;
    // Then the sidecar, which has beets loaded against the old `directory:`.
    // It is restarted lazily on the next request, by which time the config
    // will have been rewritten.
    sidecar.shutdown().await;

    let total = verdict.file_count;
    let handle = app.clone();
    let moved = tauri::async_runtime::spawn_blocking(move || -> std::io::Result<()> {
        if let Some(parent_of_target) = target.parent() {
            std::fs::create_dir_all(parent_of_target)?;
        }
        // A rename is atomic and instant when both ends share a volume. It
        // fails for a dozen reasons across volumes and none of them are worth
        // telling apart — any failure falls through to the copy.
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
        // Only once every byte is on the other side.
        std::fs::remove_dir_all(&current)?;
        Ok(())
    })
    .await
    .map_err(|err| AppError::Setup(err.to_string()))?;
    moved?;

    let target = parent.join(FOLDER_NAME);
    preferences::set_library_dir(app, Some(target.clone())).await?;
    app.state::<LibraryRoot>().set(Some(target.clone()));

    // Rewrites `directory:` in both beets configs and widens the asset scope to
    // the new folder — without which every cover in the app would 404.
    python_env::adopt_library_dir(app).await?;

    location(app)
}

/// Where the library is, and whether that is still the app's own choice.
pub fn location(app: &AppHandle) -> AppResult<LibraryLocation> {
    let paths = AppPaths::resolve(app)?;
    let default_path = python_env::default_library_dir(app);
    Ok(LibraryLocation {
        is_default: paths.library_dir == default_path,
        path: paths.library_dir.display().to_string(),
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

    /// The move would be a folder swallowing itself: `rename` would either fail
    /// or, on the copy path, walk into what it is writing.
    #[test]
    fn moving_into_the_library_is_refused() {
        assert_eq!(
            check("/music/Sonarche/nested/Sonarche"),
            Some(Refusal::IntoItself)
        );
    }

    /// The one that matters most: app data is what "reset the app" is allowed
    /// to delete, and a library filed in there would go with it.
    #[test]
    fn moving_into_app_data_is_refused() {
        assert_eq!(check("/data/Sonarche"), Some(Refusal::InsideAppData));
        assert_eq!(
            check("/data/nested/deep/Sonarche"),
            Some(Refusal::InsideAppData)
        );
    }

    /// A sibling whose name merely starts with the same letters is not inside
    /// it — `starts_with` on `Path` compares components, not characters, and
    /// this is the test that says so on purpose.
    #[test]
    fn a_sibling_with_a_similar_name_is_not_inside() {
        assert_eq!(check("/music/Sonarche-old/Sonarche"), None);
        assert_eq!(check("/data-other/Sonarche"), None);
    }
}
