//! Library folder layout and the marker that claims it.
//!
//! The chosen root holds zones: `Music/` (beets' `directory:`), `Artwork/`
//! (artist and playlist images), `Playlists/` (M3U8 mirror) and the hidden
//! `.sonarche/` with `library.json`. Synchronous `std::fs`: it runs from the
//! setup hook.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// Always appended to the picked parent, so a stray pick (e.g. Home) never
/// turns an unrelated folder into the library.
pub const FOLDER_NAME: &str = "Sonarche";

pub const MUSIC_DIR: &str = "Music";
pub const ARTWORK_DIR: &str = "Artwork";
pub const PLAYLISTS_DIR: &str = "Playlists";
pub const ARTWORK_ARTISTS: &str = "Artists";
pub const ARTWORK_PLAYLISTS: &str = "Playlists";
pub const MARKER_DIR: &str = ".sonarche";
pub const MARKER_FILE: &str = "library.json";

/// Compared case-insensitively (APFS and NTFS are case-insensitive).
pub const RESERVED: [&str; 4] = [MUSIC_DIR, ARTWORK_DIR, MARKER_DIR, PLAYLISTS_DIR];

pub fn is_reserved(name: &str) -> bool {
    RESERVED.iter().any(|r| r.eq_ignore_ascii_case(name))
}

/// Contents of `library.json`. `identity` survives moves and is replaced only
/// by an erase. `layout_version` is informational; detection is by shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMarker {
    pub identity: String,
    pub layout_version: u32,
}

pub const LAYOUT_VERSION: u32 = 1;

impl LibraryMarker {
    fn new() -> Self {
        Self {
            identity: uuid::Uuid::new_v4().to_string(),
            layout_version: LAYOUT_VERSION,
        }
    }
}

pub fn marker_path(root: &Path) -> PathBuf {
    root.join(MARKER_DIR).join(MARKER_FILE)
}

/// The marker, or `None` if missing or unreadable (both mean "unproven").
pub fn read_marker(root: &Path) -> Option<LibraryMarker> {
    let raw = fs::read_to_string(marker_path(root)).ok()?;
    serde_json::from_str(&raw).ok()
}

/// Creates the zones without the marker. Safe on every launch; the marker is
/// only written once a migration has completed.
pub fn ensure_zones(root: &Path) -> AppResult<()> {
    fs::create_dir_all(root.join(MUSIC_DIR))?;
    fs::create_dir_all(root.join(ARTWORK_DIR).join(ARTWORK_ARTISTS))?;
    fs::create_dir_all(root.join(ARTWORK_DIR).join(ARTWORK_PLAYLISTS))?;
    // Created up front so the folder shows the full layout.
    fs::create_dir_all(root.join(PLAYLISTS_DIR))?;
    let marker_dir = root.join(MARKER_DIR);
    fs::create_dir_all(&marker_dir)?;
    hide_dir(&marker_dir);
    Ok(())
}

/// Zones plus marker. Idempotent; an existing marker is kept.
pub fn ensure_layout(root: &Path) -> AppResult<()> {
    ensure_zones(root)?;
    if read_marker(root).is_none() {
        let marker = LibraryMarker::new();
        fs::write(marker_path(root), serde_json::to_string_pretty(&marker)?)?;
    }
    Ok(())
}

// Launch migration: artist folders at the root move into `Music/`. Runs from
// the setup hook, idempotent. No beets DB rewrite: paths are stored relative
// to `directory:` (see `library_move.rs`).

/// Temporary name for a root entry that collides with a zone (an artist
/// called "Music").
const PARK_PREFIX: &str = ".sonarche-park-";
/// Exists while a migration runs, so after a crash a root `Music/` is known
/// to be ours.
const IN_PROGRESS_FILE: &str = "migration.json";

#[derive(Debug, Clone)]
pub struct RootEntry {
    pub name: String,
    pub is_dir: bool,
    pub is_empty_dir: bool,
}

/// Executor steps, each skipped if already done, so resuming after a crash
/// runs the same code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlanStep {
    /// `Music` → `.sonarche-park-Music`.
    Park {
        name: String,
    },
    EnsureMusic,
    MoveIntoMusic {
        name: String,
    },
    /// `Music/Music`, `Music/Artwork`.
    UnparkIntoMusic {
        park: String,
        dest: String,
    },
}

/// Plans the migration (pure; see [`execute`]).
///
/// `resuming` means `migration.json` exists, so a root `Music/` is our zone.
/// A root made only of reserved names is treated as a migrated library whose
/// marker was deleted, not as an artist called "Music".
pub fn plan_root_migration(entries: &[RootEntry], resuming: bool) -> Vec<PlanStep> {
    // Only reserved names (plus dotfiles like `.DS_Store`): adopt as-is rather
    // than nesting `Music/` into itself.
    if !resuming
        && !entries.iter().any(|e| e.name.starts_with(PARK_PREFIX))
        && entries
            .iter()
            .all(|entry| is_reserved(&entry.name) || entry.name.starts_with('.'))
    {
        return Vec::new();
    }

    let mut parks = Vec::new();
    let mut moves = Vec::new();
    let mut unparks = Vec::new();

    for entry in entries {
        let name = entry.name.as_str();
        if name.eq_ignore_ascii_case(MARKER_DIR) {
            continue;
        }
        if let Some(dest) = name.strip_prefix(PARK_PREFIX) {
            unparks.push(PlanStep::UnparkIntoMusic {
                park: name.to_string(),
                dest: dest.to_string(),
            });
            continue;
        }
        if is_reserved(name) {
            let ours = entry.is_dir
                && (entry.is_empty_dir || (resuming && name.eq_ignore_ascii_case(MUSIC_DIR)));
            if ours {
                // Empty reserved dirs hold nothing; when resuming, `Music/` is the target.
                continue;
            }
            parks.push(PlanStep::Park {
                name: name.to_string(),
            });
            unparks.push(PlanStep::UnparkIntoMusic {
                park: format!("{PARK_PREFIX}{name}"),
                dest: name.to_string(),
            });
            continue;
        }
        moves.push(PlanStep::MoveIntoMusic {
            name: name.to_string(),
        });
    }

    // Nothing to move: already the new layout.
    if parks.is_empty() && moves.is_empty() && unparks.is_empty() {
        return Vec::new();
    }

    let mut steps = parks;
    steps.push(PlanStep::EnsureMusic);
    steps.append(&mut moves);
    steps.append(&mut unparks);
    steps
}

#[derive(Debug, Default)]
struct ExecOutcome {
    moved: usize,
    failed: usize,
}

/// Best-effort per entry: a folder that won't move is logged and retried at
/// next launch rather than failing the whole migration.
enum StepResult {
    Done,
    Skipped,
    Failed,
}

/// Idempotent rename: a missing source was already moved; an occupied
/// destination is a conflict, never overwritten.
fn step_rename(from: PathBuf, to: PathBuf) -> StepResult {
    if !from.exists() {
        return StepResult::Skipped;
    }
    if to.exists() {
        eprintln!("[library] migration: {to:?} already exists, leaving {from:?}");
        return StepResult::Failed;
    }
    match fs::rename(&from, &to) {
        Ok(()) => StepResult::Done,
        Err(err) => {
            eprintln!("[library] migration: could not move {from:?}: {err}");
            StepResult::Failed
        }
    }
}

fn execute(root: &Path, steps: &[PlanStep]) -> ExecOutcome {
    let mut outcome = ExecOutcome::default();
    for step in steps {
        let result = match step {
            PlanStep::Park { name } => {
                step_rename(root.join(name), root.join(format!("{PARK_PREFIX}{name}")))
            }
            PlanStep::EnsureMusic => match fs::create_dir_all(root.join(MUSIC_DIR)) {
                Ok(()) => StepResult::Skipped,
                Err(err) => {
                    eprintln!("[library] migration: could not create Music/: {err}");
                    StepResult::Failed
                }
            },
            PlanStep::MoveIntoMusic { name } => {
                step_rename(root.join(name), root.join(MUSIC_DIR).join(name))
            }
            PlanStep::UnparkIntoMusic { park, dest } => {
                step_rename(root.join(park), root.join(MUSIC_DIR).join(dest))
            }
        };
        match result {
            StepResult::Done => outcome.moved += 1,
            StepResult::Skipped => {}
            StepResult::Failed => outcome.failed += 1,
        }
    }
    outcome
}

fn in_progress_path(root: &Path) -> PathBuf {
    root.join(MARKER_DIR).join(IN_PROGRESS_FILE)
}

fn scan_root(root: &Path) -> std::io::Result<Vec<RootEntry>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let is_dir = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
        let is_empty_dir = is_dir
            && fs::read_dir(entry.path())
                .map(|mut children| children.next().is_none())
                .unwrap_or(false);
        entries.push(RootEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            is_dir,
            is_empty_dir,
        });
    }
    Ok(entries)
}

/// Marker fast path, plan, execute; the marker is written only after a clean
/// run.
fn migrate_root(root: &Path) -> AppResult<()> {
    if read_marker(root).is_some() {
        // Sweep an in-progress file left by a crash after the marker was written.
        let _ = fs::remove_file(in_progress_path(root));
        return Ok(());
    }
    if !root.exists() || fs::read_dir(root)?.next().is_none() {
        // Fresh install or erased library.
        return ensure_layout(root);
    }

    let resuming = in_progress_path(root).exists();
    let entries = scan_root(root)?;
    let plan = plan_root_migration(&entries, resuming);

    if !plan.is_empty() && !resuming {
        // Flag the migration before the first rename.
        let marker_dir = root.join(MARKER_DIR);
        fs::create_dir_all(&marker_dir)?;
        hide_dir(&marker_dir);
        let parked: Vec<&str> = plan
            .iter()
            .filter_map(|step| match step {
                PlanStep::Park { name } => Some(name.as_str()),
                _ => None,
            })
            .collect();
        fs::write(
            in_progress_path(root),
            serde_json::to_string_pretty(&serde_json::json!({ "parked": parked }))?,
        )?;
    }

    let outcome = execute(root, &plan);
    if outcome.moved > 0 {
        eprintln!(
            "[library] migrated {} entr{} into Music/",
            outcome.moved,
            if outcome.moved == 1 { "y" } else { "ies" }
        );
    }
    if outcome.failed > 0 {
        eprintln!(
            "[library] migration incomplete ({} left), will retry next launch",
            outcome.failed
        );
        return Ok(());
    }
    ensure_layout(root)?;
    let _ = fs::remove_file(in_progress_path(root));
    Ok(())
}

/// Everything the launch owes the library before anything else touches it.
/// Errors are logged and retried next launch.
pub fn run_launch_migration(app: &tauri::AppHandle, jobs: &crate::jobs::JobsState) {
    use tauri::Manager;

    let paths = match crate::python_env::AppPaths::resolve(app) {
        Ok(paths) => paths,
        Err(err) => {
            eprintln!("[library] migration skipped, paths unresolved: {err}");
            return;
        }
    };
    if let Err(err) = migrate_root(&paths.library_root) {
        eprintln!("[library] root migration failed: {err}");
    }
    match app.path().app_data_dir() {
        Ok(app_data) => {
            if let Err(err) = migrate_artwork(&paths, &app_data, jobs) {
                eprintln!("[library] artwork migration failed: {err}");
            }
        }
        Err(err) => eprintln!("[library] artwork migration skipped: {err}"),
    }
    // The beets configs and asset scope must match before the worker resumes.
    if let Err(err) = tauri::async_runtime::block_on(crate::python_env::adopt_library_dir(app)) {
        eprintln!("[library] could not adopt the migrated layout: {err}");
    }
}

/// Rename with a copy fallback across volumes.
fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to)?;
    fs::remove_file(from)
}

/// Moves one image collection from a legacy dir (technical names) to its zone
/// (readable names), row by row: move the file, then repoint the row, so a
/// crash leaves a file to adopt rather than a dangling row. Returns the
/// filenames still referenced.
///
/// `entries` is (key, display name, current filename), sorted by name.
fn migrate_image_rows<K: Copy>(
    what: &str,
    entries: &[(K, String, String)],
    legacy_dir: &Path,
    dest_dir: &Path,
    fallback: &str,
    mut repoint: impl FnMut(K, &str) -> AppResult<()>,
    mut forget: impl FnMut(K) -> AppResult<()>,
) -> AppResult<()> {
    use crate::artwork;

    fs::create_dir_all(dest_dir)?;
    // Rows already in place keep their names.
    let mut taken: Vec<String> = entries
        .iter()
        .filter(|(_, _, filename)| dest_dir.join(filename).exists())
        .map(|(_, _, filename)| artwork::stem_of(filename).to_string())
        .collect();

    for (key, name, filename) in entries {
        if dest_dir.join(filename).exists() {
            continue; // Already consistent (migrated, or written post-layout).
        }
        let extension = Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let stem = artwork::unique_stem(name, fallback, &taken);
        let readable = format!("{stem}.{extension}");
        let legacy = legacy_dir.join(filename);
        let dest = dest_dir.join(&readable);

        if legacy.exists() {
            if let Err(err) = move_file(&legacy, &dest) {
                // Keep the row for the next launch.
                eprintln!("[{what}] could not migrate {filename}: {err}");
                continue;
            }
            repoint(*key, &readable)?;
            taken.push(stem);
        } else if dest.exists() {
            // Crashed between the move and the row update.
            repoint(*key, &readable)?;
            taken.push(stem);
        } else {
            eprintln!("[{what}] {name:?} points at a missing file, forgetting it");
            forget(*key)?;
        }
    }
    Ok(())
}

/// Deletes unreferenced files, then the dir if empty (`remove_dir` keeps it
/// while a failed move still references a file).
fn sweep_legacy_dir(dir: &Path, still_referenced: &[String]) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !still_referenced.contains(&name) {
            let _ = fs::remove_file(entry.path());
        }
    }
    let _ = fs::remove_dir(dir);
}

/// Moves app data's `artists/` and `playlists/` into `Artwork/Artists/` and
/// `Artwork/Playlists/` with readable names.
fn migrate_artwork(
    paths: &crate::python_env::AppPaths,
    app_data: &Path,
    jobs: &crate::jobs::JobsState,
) -> AppResult<()> {
    let legacy_artists = app_data.join("artists");
    let legacy_playlists = app_data.join("playlists");

    if legacy_artists.exists() {
        // Sorted by name, so collision numbering is deterministic across retries.
        let rows = jobs.with_conn_blocking(crate::jobs_store::list_artist_images)?;
        let entries: Vec<(usize, String, String)> = rows
            .iter()
            .enumerate()
            .map(|(i, row)| (i, row.name.clone(), row.filename.clone()))
            .collect();
        migrate_image_rows(
            "artist-images",
            &entries,
            &legacy_artists,
            &paths.artist_images_dir(),
            crate::artist_images::ARTIST_STEM_FALLBACK,
            |i, filename| {
                jobs.with_conn_blocking(|c| {
                    crate::jobs_store::update_artist_image_filename(c, &rows[i].name, filename)
                })
            },
            |i| {
                jobs.with_conn_blocking(|c| {
                    crate::jobs_store::remove_artist_image(c, &rows[i].name).map(|_| ())
                })
            },
        )?;
        let referenced: Vec<String> = jobs
            .with_conn_blocking(crate::jobs_store::list_artist_images)?
            .into_iter()
            .map(|row| row.filename)
            .collect();
        sweep_legacy_dir(&legacy_artists, &referenced);
    }

    if legacy_playlists.exists() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let mut rows = jobs.with_conn_blocking(crate::playlists::list)?;
        rows.sort_by(|a, b| a.name.cmp(&b.name));
        let entries: Vec<(i64, String, String)> = rows
            .iter()
            .filter_map(|row| {
                row.cover
                    .as_ref()
                    .map(|cover| (row.id, row.name.clone(), cover.clone()))
            })
            .collect();
        migrate_image_rows(
            "playlist-covers",
            &entries,
            &legacy_playlists,
            &paths.playlist_covers_dir(),
            crate::playlists::PLAYLIST_STEM_FALLBACK,
            |id, filename| {
                jobs.with_conn_blocking(|c| {
                    crate::playlists::update_cover_filename(c, id, filename, now)
                })
            },
            |id| {
                jobs.with_conn_blocking(|c| crate::playlists::remove_cover(c, id, now).map(|_| ()))
            },
        )?;
        let referenced: Vec<String> = jobs
            .with_conn_blocking(crate::playlists::list)?
            .into_iter()
            .filter_map(|row| row.cover)
            .collect();
        sweep_legacy_dir(&legacy_playlists, &referenced);
    }
    Ok(())
}

/// Windows ignores the leading dot; set the hidden attribute. Best-effort.
#[cfg(windows)]
fn hide_dir(path: &Path) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{SetFileAttributesW, FILE_ATTRIBUTE_HIDDEN};

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    // SAFETY: `wide` is a valid, NUL-terminated UTF-16 path that outlives the
    // call, which only reads it.
    unsafe {
        SetFileAttributesW(wide.as_ptr(), FILE_ATTRIBUTE_HIDDEN);
    }
}

#[cfg(not(windows))]
fn hide_dir(_path: &Path) {}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir")
    }

    #[test]
    fn marker_roundtrip() {
        let root = temp_root();
        ensure_layout(root.path()).unwrap();
        let marker = read_marker(root.path()).expect("marker written");
        assert_eq!(marker.layout_version, LAYOUT_VERSION);
        assert!(!marker.identity.is_empty());
    }

    #[test]
    fn ensure_layout_is_idempotent_and_keeps_identity() {
        let root = temp_root();
        ensure_layout(root.path()).unwrap();
        let first = read_marker(root.path()).unwrap();
        ensure_layout(root.path()).unwrap();
        let second = read_marker(root.path()).unwrap();
        assert_eq!(first.identity, second.identity);
        assert!(root.path().join(MUSIC_DIR).is_dir());
        assert!(root.path().join(ARTWORK_DIR).is_dir());
    }

    #[test]
    fn zones_include_every_folder_even_the_empty_ones() {
        let root = temp_root();
        ensure_zones(root.path()).unwrap();
        assert!(root.path().join(MUSIC_DIR).is_dir());
        assert!(root.path().join(ARTWORK_DIR).join(ARTWORK_ARTISTS).is_dir());
        assert!(root
            .path()
            .join(ARTWORK_DIR)
            .join(ARTWORK_PLAYLISTS)
            .is_dir());
        assert!(root.path().join(PLAYLISTS_DIR).is_dir());
        assert!(root.path().join(MARKER_DIR).is_dir());
    }

    #[test]
    fn broken_marker_reads_as_none() {
        let root = temp_root();
        fs::create_dir_all(root.path().join(MARKER_DIR)).unwrap();
        fs::write(marker_path(root.path()), "not json").unwrap();
        assert!(read_marker(root.path()).is_none());
        ensure_layout(root.path()).unwrap();
        assert!(read_marker(root.path()).is_some());
    }

    // Planner

    fn dir(name: &str) -> RootEntry {
        RootEntry {
            name: name.into(),
            is_dir: true,
            is_empty_dir: false,
        }
    }

    fn empty_dir(name: &str) -> RootEntry {
        RootEntry {
            name: name.into(),
            is_dir: true,
            is_empty_dir: true,
        }
    }

    fn file(name: &str) -> RootEntry {
        RootEntry {
            name: name.into(),
            is_dir: false,
            is_empty_dir: false,
        }
    }

    #[test]
    fn a_flat_layout_moves_everything_into_music() {
        let entries = [dir("AC/DC…"), dir("Skillet"), file(".DS_Store")];
        let plan = plan_root_migration(&entries, false);
        assert_eq!(plan[0], PlanStep::EnsureMusic);
        let moves = plan
            .iter()
            .filter(|s| matches!(s, PlanStep::MoveIntoMusic { .. }))
            .count();
        assert_eq!(moves, 3, "{plan:?}");
    }

    #[test]
    fn an_artist_named_music_is_parked_then_filed_inside_music() {
        for name in ["Music", "music", "MUSIC", "Artwork", "Playlists"] {
            let entries = [dir(name), dir("Skillet")];
            let plan = plan_root_migration(&entries, false);
            assert_eq!(
                plan.first(),
                Some(&PlanStep::Park { name: name.into() }),
                "{name}"
            );
            assert_eq!(
                plan.last(),
                Some(&PlanStep::UnparkIntoMusic {
                    park: format!("{PARK_PREFIX}{name}"),
                    dest: name.into(),
                }),
                "{name}"
            );
        }
    }

    #[test]
    fn an_empty_reserved_dir_is_adopted_not_parked() {
        let entries = [empty_dir("Music"), dir("Skillet")];
        let plan = plan_root_migration(&entries, false);
        assert!(
            !plan.iter().any(|s| matches!(s, PlanStep::Park { .. })),
            "{plan:?}"
        );
    }

    #[test]
    fn an_all_reserved_root_is_read_as_already_migrated() {
        // Marker deleted by hand: adopt, never nest.
        let entries = [dir("Music"), dir("Artwork"), dir(MARKER_DIR)];
        assert!(plan_root_migration(&entries, false).is_empty());
    }

    #[test]
    fn resuming_treats_a_filled_music_as_the_destination() {
        let entries = [dir("Music"), dir("Skillet")];
        let plan = plan_root_migration(&entries, true);
        assert!(
            !plan.iter().any(|s| matches!(s, PlanStep::Park { .. })),
            "{plan:?}"
        );
        assert!(plan.contains(&PlanStep::MoveIntoMusic {
            name: "Skillet".into()
        }));
    }

    #[test]
    fn resuming_finishes_a_parked_entry() {
        let entries = [dir("Music"), dir(&format!("{PARK_PREFIX}Music"))];
        let plan = plan_root_migration(&entries, true);
        assert_eq!(
            plan.last(),
            Some(&PlanStep::UnparkIntoMusic {
                park: format!("{PARK_PREFIX}Music"),
                dest: "Music".into(),
            })
        );
    }

    // Executor and orchestrator, on a temp filesystem

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"x").unwrap();
    }

    #[test]
    fn an_old_layout_migrates_whole() {
        let root = temp_root();
        touch(&root.path().join("Skillet/Awake/Monster.m4a"));
        touch(&root.path().join("Skillet/Awake/cover.jpg"));
        touch(&root.path().join("AC-DC/Back in Black/Hells Bells.m4a"));
        touch(&root.path().join(".DS_Store"));

        migrate_root(root.path()).unwrap();

        assert!(read_marker(root.path()).is_some());
        assert!(root
            .path()
            .join("Music/Skillet/Awake/Monster.m4a")
            .is_file());
        assert!(root
            .path()
            .join("Music/AC-DC/Back in Black/Hells Bells.m4a")
            .is_file());
        assert!(root.path().join("Music/.DS_Store").is_file());
        assert!(!root.path().join("Skillet").exists());
        assert!(!in_progress_path(root.path()).exists());
    }

    #[test]
    fn migrating_twice_changes_nothing() {
        let root = temp_root();
        touch(&root.path().join("Skillet/Awake/Monster.m4a"));
        migrate_root(root.path()).unwrap();
        let identity = read_marker(root.path()).unwrap().identity;

        migrate_root(root.path()).unwrap();

        assert_eq!(read_marker(root.path()).unwrap().identity, identity);
        assert!(root
            .path()
            .join("Music/Skillet/Awake/Monster.m4a")
            .is_file());
        assert!(!root.path().join("Music/Music").exists());
    }

    #[test]
    fn an_artist_actually_named_music_survives() {
        let root = temp_root();
        touch(&root.path().join("Music/An Album/track.m4a"));
        touch(&root.path().join("Skillet/Awake/Monster.m4a"));

        migrate_root(root.path()).unwrap();

        assert!(root.path().join("Music/Music/An Album/track.m4a").is_file());
        assert!(root
            .path()
            .join("Music/Skillet/Awake/Monster.m4a")
            .is_file());
    }

    #[test]
    fn an_interrupted_migration_resumes_where_it_stopped() {
        let root = temp_root();
        // Frozen mid-flight: flag present, "Music" parked, one artist moved.
        touch(&root.path().join(format!("{PARK_PREFIX}Music/Album/t.m4a")));
        touch(&root.path().join("Music/Done Artist/Album/t.m4a"));
        touch(&root.path().join("Left Behind/Album/t.m4a"));
        fs::create_dir_all(root.path().join(MARKER_DIR)).unwrap();
        fs::write(in_progress_path(root.path()), r#"{"parked":["Music"]}"#).unwrap();

        migrate_root(root.path()).unwrap();

        assert!(read_marker(root.path()).is_some());
        assert!(!in_progress_path(root.path()).exists());
        assert!(root.path().join("Music/Music/Album/t.m4a").is_file());
        assert!(root.path().join("Music/Done Artist/Album/t.m4a").is_file());
        assert!(root.path().join("Music/Left Behind/Album/t.m4a").is_file());
    }

    #[test]
    fn a_fresh_root_gets_the_layout_and_nothing_else() {
        let root = temp_root();
        migrate_root(root.path()).unwrap();
        assert!(read_marker(root.path()).is_some());
        assert!(root.path().join(MUSIC_DIR).is_dir());
        assert!(fs::read_dir(root.path().join(MUSIC_DIR))
            .unwrap()
            .next()
            .is_none());
    }

    #[test]
    fn a_blocked_entry_leaves_the_marker_unwritten() {
        let root = temp_root();
        // The same artist exists on both sides: a conflict rename can't resolve.
        touch(&root.path().join("Skillet/Awake/Monster.m4a"));
        touch(&root.path().join("Music/Skillet/other.m4a"));
        fs::create_dir_all(root.path().join(MARKER_DIR)).unwrap();
        fs::write(in_progress_path(root.path()), r#"{"parked":[]}"#).unwrap();

        migrate_root(root.path()).unwrap();

        assert!(read_marker(root.path()).is_none(), "must not claim success");
        assert!(
            in_progress_path(root.path()).exists(),
            "flag stays for the retry"
        );
        // Nothing destroyed on either side.
        assert!(root.path().join("Skillet/Awake/Monster.m4a").is_file());
        assert!(root.path().join("Music/Skillet/other.m4a").is_file());
    }

    // Artwork migration

    /// The row store as closures over a map; what matters is the file/row order.
    fn run_artwork(
        entries: &[(usize, String, String)],
        legacy: &Path,
        dest: &Path,
    ) -> std::collections::HashMap<usize, Option<String>> {
        let outcome = std::cell::RefCell::new(std::collections::HashMap::new());
        migrate_image_rows(
            "test-images",
            entries,
            legacy,
            dest,
            "Artist",
            |key, filename| {
                outcome.borrow_mut().insert(key, Some(filename.to_string()));
                Ok(())
            },
            |key| {
                outcome.borrow_mut().insert(key, None);
                Ok(())
            },
        )
        .unwrap();
        outcome.into_inner()
    }

    fn entry(key: usize, name: &str, filename: &str) -> (usize, String, String) {
        (key, name.to_string(), filename.to_string())
    }

    #[test]
    fn technical_names_become_readable_ones() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        let dest = root.path().join("Artwork/Artists");
        touch(&legacy.join("ab12.jpg"));
        touch(&legacy.join("cd34.png"));

        let entries = [
            entry(0, "AC/DC", "ab12.jpg"),
            entry(1, "Skillet", "cd34.png"),
        ];
        let outcome = run_artwork(&entries, &legacy, &dest);

        assert_eq!(outcome[&0].as_deref(), Some("AC_DC.jpg"));
        assert_eq!(outcome[&1].as_deref(), Some("Skillet.png"));
        assert!(dest.join("AC_DC.jpg").is_file());
        assert!(dest.join("Skillet.png").is_file());
        assert!(!legacy.join("ab12.jpg").exists());
    }

    #[test]
    fn colliding_artist_names_are_numbered_deterministically() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        let dest = root.path().join("dest");
        touch(&legacy.join("a.jpg"));
        touch(&legacy.join("b.jpg"));

        let entries = [entry(0, "AC/DC", "a.jpg"), entry(1, "AC:DC", "b.jpg")];
        let outcome = run_artwork(&entries, &legacy, &dest);

        assert_eq!(outcome[&0].as_deref(), Some("AC_DC.jpg"));
        assert_eq!(outcome[&1].as_deref(), Some("AC_DC (2).jpg"));
    }

    #[test]
    fn a_consistent_row_is_left_alone() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        let dest = root.path().join("dest");
        fs::create_dir_all(&legacy).unwrap();
        touch(&dest.join("Skillet.jpg"));

        let entries = [entry(0, "Skillet", "Skillet.jpg")];
        let outcome = run_artwork(&entries, &legacy, &dest);

        assert!(outcome.is_empty(), "no store call for a settled row");
        assert!(dest.join("Skillet.jpg").is_file());
    }

    #[test]
    fn a_crash_between_move_and_row_update_is_adopted() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        let dest = root.path().join("dest");
        fs::create_dir_all(&legacy).unwrap();
        // File already moved, row still on the technical name.
        touch(&dest.join("Skillet.jpg"));

        let entries = [entry(0, "Skillet", "ab12.jpg")];
        let outcome = run_artwork(&entries, &legacy, &dest);

        assert_eq!(outcome[&0].as_deref(), Some("Skillet.jpg"));
    }

    #[test]
    fn a_row_whose_file_vanished_is_forgotten() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        let dest = root.path().join("dest");
        fs::create_dir_all(&legacy).unwrap();

        let entries = [entry(0, "Skillet", "gone.jpg")];
        let outcome = run_artwork(&entries, &legacy, &dest);

        assert_eq!(outcome[&0], None, "forgotten, not repointed");
    }

    #[test]
    fn the_legacy_sweep_spares_referenced_files_and_full_dirs() {
        let root = temp_root();
        let legacy = root.path().join("legacy");
        touch(&legacy.join("orphan.jpg"));
        touch(&legacy.join("stuck.jpg"));

        sweep_legacy_dir(&legacy, &["stuck.jpg".to_string()]);

        assert!(!legacy.join("orphan.jpg").exists());
        assert!(legacy.join("stuck.jpg").is_file());
        assert!(legacy.exists(), "dir survives while a file is referenced");

        sweep_legacy_dir(&legacy, &[]);
        assert!(!legacy.exists(), "empty dir goes");
    }

    #[test]
    fn reserved_names_ignore_case() {
        for name in [
            "Music",
            "music",
            "MUSIC",
            "artwork",
            ".SONARCHE",
            "playlists",
        ] {
            assert!(is_reserved(name), "{name}");
        }
        assert!(!is_reserved("Muse"));
        assert!(!is_reserved("The Playlists Band "));
    }
}
