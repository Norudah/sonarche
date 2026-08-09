//! The shape of the library folder, and the marker that names it ours.
//!
//! The root the user picks holds zones, not artist folders: `Music/` is the
//! beets `directory:`, `Artwork/` holds artist and playlist images, and the
//! hidden `.sonarche/` carries `library.json` — the file that says "this
//! folder is a Sonarche library" and which layout it uses. Everything here is
//! synchronous `std::fs` on purpose: it runs from Tauri's setup hook, before
//! the async runtime has anything to do.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// The folder the library always lives in, inside whatever parent is chosen.
///
/// The picker asks for a parent and we append this, rather than taking the
/// picked folder as the library itself. Two reasons, both about the folder the
/// user did not mean to give us: a stray click on Home would spray an album
/// tree over their home directory, and "remove the library" further down the
/// settings screen would then have a folder full of unrelated things to
/// remove. A named folder is one we can be sure we own.
pub const FOLDER_NAME: &str = "Sonarche";

/// The beets zone: `directory:` points here, and only here.
pub const MUSIC_DIR: &str = "Music";
/// Artist and playlist images, under human-readable names.
pub const ARTWORK_DIR: &str = "Artwork";
pub const ARTWORK_ARTISTS: &str = "Artists";
pub const ARTWORK_PLAYLISTS: &str = "Playlists";
/// Our hidden corner: marker, and whatever future state wants a home.
pub const MARKER_DIR: &str = ".sonarche";
pub const MARKER_FILE: &str = "library.json";

/// Names the root reserves for itself. `Playlists` is claimed now, before the
/// M3U mirror exists, so an artist of that name is filed under `Music/` today
/// and no second migration is needed when the mirror lands. Compared without
/// case: APFS and NTFS would happily collide "music" with `Music/`.
pub const RESERVED: [&str; 4] = [MUSIC_DIR, ARTWORK_DIR, MARKER_DIR, "Playlists"];

pub fn is_reserved(name: &str) -> bool {
    RESERVED.iter().any(|r| r.eq_ignore_ascii_case(name))
}

/// What `library.json` holds.
///
/// `identity` names this library across moves and reinstalls; it is minted
/// once and only replaced when the data itself is erased. `layout_version` is
/// forensic, not a gate — detection stays by shape (see the schema-migration
/// note in `jobs_store.rs` for why version gating is a trap).
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

/// The marker, or `None` for anything short of a readable one — a missing
/// file and a corrupt file get the same answer, because the remedy is the
/// same: treat the layout as unproven and let the idempotent migration prove
/// it again.
pub fn read_marker(root: &Path) -> Option<LibraryMarker> {
    let raw = fs::read_to_string(marker_path(root)).ok()?;
    serde_json::from_str(&raw).ok()
}

/// The zones without the marker. This is what every-launch repair
/// ([`crate::python_env::adopt_library_dir`]) may call: directories are cheap
/// and safe to re-assert, while the marker is a *claim* — "this layout has
/// been proven" — that only the migration and the erase path may make. An
/// adopt that wrote the marker would stamp a half-migrated library as done
/// and the next launch would never finish the job.
pub fn ensure_zones(root: &Path) -> AppResult<()> {
    fs::create_dir_all(root.join(MUSIC_DIR))?;
    fs::create_dir_all(root.join(ARTWORK_DIR).join(ARTWORK_ARTISTS))?;
    fs::create_dir_all(root.join(ARTWORK_DIR).join(ARTWORK_PLAYLISTS))?;
    let marker_dir = root.join(MARKER_DIR);
    fs::create_dir_all(&marker_dir)?;
    hide_dir(&marker_dir);
    Ok(())
}

/// Make the layout true and claimed: zones plus marker. Idempotent — an
/// existing marker (and its identity) is left alone.
pub fn ensure_layout(root: &Path) -> AppResult<()> {
    ensure_zones(root)?;
    if read_marker(root).is_none() {
        let marker = LibraryMarker::new();
        fs::write(marker_path(root), serde_json::to_string_pretty(&marker)?)?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Launch migration: the old flat layout (artist folders at the root) becomes
// the zoned one. Silent, synchronous, and idempotent — it runs from the setup
// hook before the jobs worker or the first render can look at the library, so
// there is nothing to pause and nobody to ask. Beets needs no database rewrite:
// paths are stored relative to `directory:`, and moving every artist folder
// into `Music/` while repointing `directory:` leaves each relative path
// exactly as it was (see the note atop `library_move.rs`).
// ---------------------------------------------------------------------------

/// Where a reserved-named entry waits while `Music/` is created. An artist
/// really can be called "Music" — parking first, moving last, resolves the
/// collision without a database in sight.
const PARK_PREFIX: &str = ".sonarche-park-";
/// Present while a migration is under way; its existence is what removes the
/// ambiguity after a crash — with it on disk, a `Music/` at the root is OURS
/// (we created it), never an artist that happens to share the name.
const IN_PROGRESS_FILE: &str = "migration.json";

/// One root entry, as the planner sees it. A plain value so the planner can be
/// pure and tested without a filesystem.
#[derive(Debug, Clone)]
pub struct RootEntry {
    pub name: String,
    pub is_dir: bool,
    pub is_empty_dir: bool,
}

/// What the executor does, in order. Every step is "do it if not already
/// done", which makes resuming after a crash the same code as running fresh.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlanStep {
    /// A reserved-named entry steps aside: `Music` → `.sonarche-park-Music`.
    Park { name: String },
    /// `mkdir Music`, once the name is free.
    EnsureMusic,
    /// An ordinary entry (artist folder, stray `.DS_Store`) files into `Music/`.
    MoveIntoMusic { name: String },
    /// A parked entry lands at its final home: `Music/Music`, `Music/Artwork`.
    UnparkIntoMusic { park: String, dest: String },
}

/// Decide what has to move. Pure — the filesystem work is [`execute`]'s.
///
/// `resuming` is the crash-recovery switch: with `migration.json` on disk, a
/// `Music/` at the root is the zone this code created and must not be parked
/// again. Without it, a fresh look at an old layout begins.
///
/// One deliberate blind spot: a root whose entries are *all* reserved names is
/// read as an already-migrated library that lost its marker (a hand-deleted
/// `.sonarche/`), and adopted as-is. The one collection it misreads — an
/// old-layout library whose only artist is literally named "Music" — is
/// vanishingly rarer than a deleted dotfolder.
pub fn plan_root_migration(entries: &[RootEntry], resuming: bool) -> Vec<PlanStep> {
    // The marker-lost heuristic, first: a root made only of our own names
    // (plus dotfile junk — macOS puts a `.DS_Store` everywhere) is an
    // already-migrated library whose `.sonarche/` was hand-deleted. Adopt it
    // as-is — parking its `Music/` would nest the zone into itself. A parked
    // entry disables the shortcut: it exists to be unparked.
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
                // An empty reserved dir carries nothing an artist would own;
                // under `resuming`, a filled `Music/` is the destination zone.
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

    // The marker-lost heuristic: nothing to move and nothing parked mid-flight
    // means the shape is already the new one — adopt, don't nest.
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

/// Carry the plan out, best-effort per entry: one artist folder that will not
/// budge (a sync client holding it open, say) is logged and left for the next
/// launch, instead of failing the whole migration — a three-quarters-migrated
/// library that opens beats an app that refuses to start.
enum StepResult {
    Done,
    Skipped,
    Failed,
}

/// One idempotent rename: a missing source was handled on a previous launch,
/// an occupied destination is a real conflict this code will not resolve by
/// overwriting.
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

/// The root migration proper: marker fast path, plan, execute, and only on a
/// clean run the marker — the commit point — is written.
fn migrate_root(root: &Path) -> AppResult<()> {
    if read_marker(root).is_some() {
        // Steady state. A stale in-progress file (crash after the marker was
        // written, before the cleanup) is swept here.
        let _ = fs::remove_file(in_progress_path(root));
        return Ok(());
    }
    if !root.exists() || fs::read_dir(root)?.next().is_none() {
        // Fresh install (or a freshly erased library): nothing to move.
        return ensure_layout(root);
    }

    let resuming = in_progress_path(root).exists();
    let entries = scan_root(root)?;
    let plan = plan_root_migration(&entries, resuming);

    if !plan.is_empty() && !resuming {
        // Declare the migration before the first rename, so a crash halfway
        // leaves a flag instead of an ambiguity.
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
        // No marker: the next launch sees the in-progress file and finishes.
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

/// Everything the launch owes the library before anyone else may touch it.
/// Never fails the launch: an error is logged and retried next time.
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
    // Belt and braces: the beets configs and the asset scope must describe the
    // new layout before the worker resumes a queued job — not merely by the
    // first env check.
    if let Err(err) = tauri::async_runtime::block_on(crate::python_env::adopt_library_dir(app)) {
        eprintln!("[library] could not adopt the migrated layout: {err}");
    }
}

/// Rename, surviving a volume boundary: app data and the library root are not
/// promised to share a filesystem, and these are 500px images — a copy is
/// nothing.
fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to)?;
    fs::remove_file(from)
}

/// One image collection's move from a technical-name legacy dir to a
/// readable-name zone. Row by row, deterministically (the caller passes rows
/// sorted by name): compute the readable destination, move the file, then
/// repoint the row — in that order, so a crash leaves a file the next launch
/// adopts rather than a row pointing at nothing. Returns the filenames now
/// referenced, so the caller's sweep knows what it may not delete.
///
/// `entries` is (key, display-name, current filename); `repoint`/`forget`
/// write the store side.
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
    // Stems already settled — rows whose file is in place keep their name and
    // block it for everyone else.
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
                // Keep the row (and its legacy file) for the next launch.
                eprintln!("[{what}] could not migrate {filename}: {err}");
                continue;
            }
            repoint(*key, &readable)?;
            taken.push(stem);
        } else if dest.exists() {
            // A previous run crashed between the move and the row update.
            repoint(*key, &readable)?;
            taken.push(stem);
        } else {
            // The file exists nowhere: a dead index row, swept like any orphan.
            eprintln!("[{what}] {name:?} points at a missing file, forgetting it");
            forget(*key)?;
        }
    }
    Ok(())
}

/// Sweep a legacy image dir: everything unreferenced goes, then the dir
/// itself — `remove_dir`, not `remove_dir_all`, so a file a failed move still
/// references keeps the dir (and the retry) alive.
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

/// The images' side of the launch migration: app data's `artists/` and
/// `playlists/` (UUID names) become the library's `Artwork/Artists/` and
/// `Artwork/Playlists/` (readable names). Independent of the root marker —
/// the fast path is simply "no legacy dir left".
fn migrate_artwork(
    paths: &crate::python_env::AppPaths,
    app_data: &Path,
    jobs: &crate::jobs::JobsState,
) -> AppResult<()> {
    let legacy_artists = app_data.join("artists");
    let legacy_playlists = app_data.join("playlists");

    if legacy_artists.exists() {
        // Name-keyed: rows arrive sorted by name, which makes the collision
        // numbering deterministic across retries.
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

/// A leading dot means nothing to Windows Explorer; the hidden attribute has
/// to be set by hand. Best-effort — a visible `.sonarche` is a cosmetic bug,
/// not a broken library.
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
    // call; the function reads it and touches nothing else of ours.
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
    fn broken_marker_reads_as_none() {
        let root = temp_root();
        fs::create_dir_all(root.path().join(MARKER_DIR)).unwrap();
        fs::write(marker_path(root.path()), "not json").unwrap();
        assert!(read_marker(root.path()).is_none());
        // And ensure_layout replaces it rather than choking on it.
        ensure_layout(root.path()).unwrap();
        assert!(read_marker(root.path()).is_some());
    }

    // -- planner ------------------------------------------------------------

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
        // The marker was hand-deleted: adopt, never nest Music into itself.
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

    // -- executor + orchestrator, on a real (temp) filesystem ---------------

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
        // Frozen mid-flight: the flag exists, "Music" the artist is parked,
        // Music/ the zone was created and one artist is already inside.
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
        // Nothing was invented: Music/ is empty.
        assert!(fs::read_dir(root.path().join(MUSIC_DIR))
            .unwrap()
            .next()
            .is_none());
    }

    #[test]
    fn a_blocked_entry_leaves_the_marker_unwritten() {
        let root = temp_root();
        // Resuming, and the same artist somehow exists on both sides — the one
        // collision a rename cannot resolve on its own.
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
        // And nothing was destroyed on either side.
        assert!(root.path().join("Skillet/Awake/Monster.m4a").is_file());
        assert!(root.path().join("Music/Skillet/other.m4a").is_file());
    }

    // -- artwork migration --------------------------------------------------

    /// The row store as two closures over a plain map — the real ones are thin
    /// SQL; what needs proving is the file/row choreography.
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

        // Sorted by name, as the caller promises: "AC/DC" then "AC:DC".
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
        // File already moved and renamed, row still on the technical name.
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
