//! `Playlists/`: the library's playlists, written out as M3U8.
//!
//! A playlist lives in sonarche.db and nowhere else — which makes it invisible
//! to Music.app, to a phone, to whatever the user copies the folder onto. This
//! writes a mirror: one `.m3u8` per non-empty playlist, rewritten in full after
//! every mutation.
//!
//! Mirror, not storage. The M3U format has no stable identifier — a track is a
//! path, so renaming one file silently drops it from every list that named it —
//! so nothing here is ever read back. sonarche.db stays the source of truth and
//! `Playlists/` is a rendering of it, the same way `Music/` is beets' rendering
//! of the index. Delete a file by hand and the next write puts it back.
//!
//! Paths are relative (`../Music/…`), which is what makes copying the whole
//! `Sonarche/` folder to another disc a working backup rather than a folder of
//! dead links. Beets already stores its paths relative to `directory:`, so the
//! relative form is a prefix away — see `resolve_tracks`.

use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::Path;

use rusqlite::{Connection, OpenFlags};
use tauri::{AppHandle, Manager};

use crate::artwork;
use crate::error::AppResult;
use crate::jobs::JobsState;
use crate::library_layout::MUSIC_DIR;
use crate::playlists::{PlaylistRow, PLAYLIST_STEM_FALLBACK};
use crate::python_env::AppPaths;

/// UTF-8 is the whole point of the `8`: playlist and track names are not
/// ASCII, and plain `.m3u` leaves the encoding to the reader's guess.
const EXTENSION: &str = "m3u8";

/// How many ids one `WHERE id IN (…)` carries. SQLite's default variable
/// ceiling is 999; staying under it costs one extra round trip per 900 tracks
/// and removes a failure mode that only shows up on large libraries.
const ID_CHUNK: usize = 900;

/// What one entry needs to be more than a bare path: readers show `title` in
/// their own UI, and `seconds` fills the duration column before anything has
/// been decoded.
#[derive(Debug, Clone, PartialEq)]
pub struct MirrorTrack {
    /// Written as-is into the file: relative to the playlists folder when the
    /// track lives under `Music/`, absolute otherwise.
    pub path: String,
    pub title: String,
    pub artist: String,
    pub seconds: i64,
}

/// One file to write. Held in memory before touching the disc so the whole
/// folder is planned — including collisions — before any of it exists.
#[derive(Debug, Clone, PartialEq)]
pub struct MirrorFile {
    pub filename: String,
    pub contents: String,
}

/// The files `Playlists/` should hold, given the playlists and the tracks they
/// resolve to.
///
/// Empty playlists produce nothing. A new library's Favorites is empty, and an
/// empty file would mean the folder appears — with a stub in it — before the
/// user has made a single playlist.
///
/// Ids missing from `tracks` are skipped rather than written blank: a playlist
/// can outlive a deleted file, and the front already filters those rows out.
pub fn plan(rows: &[PlaylistRow], tracks: &HashMap<i64, MirrorTrack>) -> Vec<MirrorFile> {
    let mut taken: Vec<String> = Vec::new();
    let mut files = Vec::new();
    for row in rows {
        let entries: Vec<&MirrorTrack> = row
            .item_ids
            .iter()
            .filter_map(|id| tracks.get(id))
            .collect();
        if entries.is_empty() {
            continue;
        }
        // Numbering is only stable if the walk order is: `list` returns
        // playlists in a fixed order, so "Live (2)" stays on the same playlist
        // across rewrites instead of trading places with its twin.
        let stem = artwork::unique_stem(&row.name, PLAYLIST_STEM_FALLBACK, &taken);
        taken.push(stem.clone());
        files.push(MirrorFile {
            filename: format!("{stem}.{EXTENSION}"),
            contents: render(&entries),
        });
    }
    files
}

/// Extended M3U: a header, then a metadata line and a path per track.
fn render(entries: &[&MirrorTrack]) -> String {
    let mut out = String::from("#EXTM3U\n");
    for track in entries {
        out.push_str(&format!(
            "#EXTINF:{},{} - {}\n{}\n",
            track.seconds,
            sanitize_line(&track.artist),
            sanitize_line(&track.title),
            track.path
        ));
    }
    out
}

/// A tag can hold a newline; a line break inside `#EXTINF` would turn the rest
/// of the title into a path.
fn sanitize_line(value: &str) -> String {
    value.replace(['\n', '\r'], " ")
}

/// Resolve beets item ids to what the mirror writes for them.
///
/// Read-only on purpose: the beets database is the sidecar's to write, and
/// opening it any other way is how two writers meet. Unknown ids simply miss
/// from the map.
pub fn resolve_tracks(
    beets_db: &Path,
    ids: &BTreeSet<i64>,
) -> AppResult<HashMap<i64, MirrorTrack>> {
    let mut tracks = HashMap::new();
    if ids.is_empty() || !beets_db.exists() {
        return Ok(tracks);
    }
    let conn = Connection::open_with_flags(
        beets_db,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )?;
    let ids: Vec<i64> = ids.iter().copied().collect();
    for chunk in ids.chunks(ID_CHUNK) {
        let placeholders = std::iter::repeat_n("?", chunk.len())
            .collect::<Vec<_>>()
            .join(",");
        let mut stmt = conn.prepare(&format!(
            "SELECT id, path, title, artist, length FROM items WHERE id IN ({placeholders})"
        ))?;
        let rows = stmt.query_map(rusqlite::params_from_iter(chunk), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, Option<f64>>(4)?.unwrap_or_default(),
            ))
        })?;
        for row in rows {
            let (id, path, title, artist, length) = row?;
            let stored = String::from_utf8_lossy(&path).into_owned();
            if stored.is_empty() {
                continue;
            }
            tracks.insert(
                id,
                MirrorTrack {
                    path: mirror_path(&stored),
                    title,
                    artist,
                    seconds: length.round() as i64,
                },
            );
        }
    }
    Ok(tracks)
}

/// The path an entry carries, from the path beets stored.
///
/// Beets keeps paths relative to `directory:` with a POSIX separator when the
/// file lives under it — which, since `directory:` is `Music/`, makes the
/// mirror's own relative form one prefix away. Anything absolute (a file
/// outside the library) is written as it stands: a broken relative link would
/// be worse than an honest machine-specific one.
fn mirror_path(stored: &str) -> String {
    if Path::new(stored).is_absolute() || stored.starts_with('/') {
        return stored.to_string();
    }
    format!("../{MUSIC_DIR}/{stored}")
}

/// Bring `Playlists/` in line with `files`, and nothing else in line with
/// anything.
///
/// Only `.m3u8` is ever removed. The folder is ours, but a user who dropped
/// their own file in it should find it there afterwards.
pub fn write(dir: &Path, files: &[MirrorFile]) -> AppResult<()> {
    if files.is_empty() {
        // Nothing to mirror: sweep what is left, but do not create the folder
        // just to leave it empty.
        if dir.exists() {
            sweep(dir, &BTreeSet::new())?;
        }
        return Ok(());
    }
    fs::create_dir_all(dir)?;
    let mut written = BTreeSet::new();
    for file in files {
        let path = dir.join(&file.filename);
        // Write-if-changed. A rewrite that only bumps mtimes wakes every
        // syncing client watching the folder, for a file that is byte-for-byte
        // what it already held.
        let current = fs::read_to_string(&path).ok();
        if current.as_deref() != Some(file.contents.as_str()) {
            fs::write(&path, &file.contents)?;
        }
        written.insert(file.filename.to_lowercase());
    }
    sweep(dir, &written)?;
    Ok(())
}

/// Drop the playlists that no longer exist — renamed, deleted, or emptied.
///
/// Names are compared lowercased: on APFS and NTFS the file we just wrote as
/// "Été.m3u8" can be sitting there under a different case, and an exact
/// comparison would call it an orphan and delete what was just written.
fn sweep(dir: &Path, keep: &BTreeSet<String>) -> AppResult<()> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_mirror = Path::new(&name)
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case(EXTENSION));
        if is_mirror && !keep.contains(&name.to_lowercase()) {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}

/// The whole pass, synchronous: resolve, plan, write.
pub fn sync_blocking(paths: &AppPaths, rows: &[PlaylistRow]) -> AppResult<()> {
    let ids: BTreeSet<i64> = rows
        .iter()
        .flat_map(|row| row.item_ids.iter().copied())
        .collect();
    let tracks = resolve_tracks(&paths.beets_db, &ids)?;
    write(&paths.playlists_dir(), &plan(rows, &tracks))
}

/// The launch pass, from the setup hook: synchronous, because the worker is
/// not running yet and nothing else is competing for the connection. Silent on
/// failure for the same reason as `sync` — a mirror is never worth blocking a
/// launch over.
pub fn sync_at_launch(app: &AppHandle, jobs: &JobsState) {
    let outcome = AppPaths::resolve(app).and_then(|paths| {
        let rows = jobs.with_conn_blocking(crate::playlists::list)?;
        sync_blocking(&paths, &rows)
    });
    if let Err(err) = outcome {
        eprintln!("[playlists] mirror not refreshed at launch: {err}");
    }
}

/// The hook every mutation calls. Best-effort by design: the playlist is
/// already saved by the time this runs, and a folder that could not be written
/// — a full disc, a volume that went away — must not turn a successful
/// mutation into an error the user has to make sense of. The next pass fixes
/// it.
pub async fn sync(app: &AppHandle, jobs: &JobsState) {
    let Ok(paths) = AppPaths::resolve(app) else {
        return;
    };
    let rows = match jobs.list_playlists().await {
        Ok(rows) => rows,
        Err(err) => {
            eprintln!("[playlists] mirror skipped, could not list: {err}");
            return;
        }
    };
    let done = tauri::async_runtime::spawn_blocking(move || sync_blocking(&paths, &rows)).await;
    match done {
        Ok(Err(err)) => eprintln!("[playlists] mirror not written: {err}"),
        Err(err) => eprintln!("[playlists] mirror task failed: {err}"),
        Ok(Ok(())) => {}
    }
}

/// Same pass, for callers that hold the app handle but not the jobs state —
/// the library operations that move files without knowing playlists exist.
pub async fn sync_after_library_change(app: &AppHandle) {
    // `state` panics on a state that was never managed; the mirror is not
    // worth taking the app down for.
    let Some(jobs) = app.try_state::<JobsState>() else {
        return;
    };
    sync(app, &jobs).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(path: &str, title: &str, artist: &str, seconds: i64) -> MirrorTrack {
        MirrorTrack {
            path: path.into(),
            title: title.into(),
            artist: artist.into(),
            seconds,
        }
    }

    fn row(id: i64, name: &str, item_ids: Vec<i64>) -> PlaylistRow {
        PlaylistRow {
            id,
            name: name.into(),
            kind: "user".into(),
            cover: None,
            marker: None,
            created_at: 0,
            updated_at: 0,
            item_ids,
        }
    }

    /// The columns and the storage class beets actually uses: `path` is a
    /// BLOB, `length` a float, and a relative path uses `/` on every platform.
    fn beets_db_with(rows: &[(i64, &str, &str, &str, f64)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let conn = Connection::open(dir.path().join("library.db")).unwrap();
        conn.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, path BLOB, title TEXT, artist TEXT, length REAL)",
            [],
        )
        .unwrap();
        for (id, path, title, artist, length) in rows {
            conn.execute(
                "INSERT INTO items (id, path, title, artist, length) VALUES (?, ?, ?, ?, ?)",
                rusqlite::params![id, path.as_bytes(), title, artist, length],
            )
            .unwrap();
        }
        dir
    }

    #[test]
    fn tracks_are_read_out_of_the_beets_database_as_stored() {
        let dir = beets_db_with(&[(
            7,
            "Daft Punk/Discovery/01 One More Time.m4a",
            "One More Time",
            "Daft Punk",
            320.4,
        )]);
        let tracks =
            resolve_tracks(&dir.path().join("library.db"), &BTreeSet::from([7, 99])).unwrap();
        assert_eq!(
            tracks.get(&7),
            Some(&track(
                "../Music/Daft Punk/Discovery/01 One More Time.m4a",
                "One More Time",
                "Daft Punk",
                320
            ))
        );
        assert!(!tracks.contains_key(&99));
    }

    /// Every id in one statement is the shape that breaks first on a real
    /// library — SQLite caps bound variables well under a big playlist.
    #[test]
    fn more_ids_than_one_statement_can_bind_are_resolved_in_full() {
        let paths: Vec<String> = (0..2_500).map(|i| format!("A/B/{i}.m4a")).collect();
        let rows: Vec<(i64, &str, &str, &str, f64)> = paths
            .iter()
            .enumerate()
            .map(|(i, path)| (i as i64 + 1, path.as_str(), "T", "A", 1.0))
            .collect();
        let dir = beets_db_with(&rows);
        let ids: BTreeSet<i64> = (1..=2_500).collect();
        let tracks = resolve_tracks(&dir.path().join("library.db"), &ids).unwrap();
        assert_eq!(tracks.len(), 2_500);
    }

    #[test]
    fn a_library_with_no_database_yet_resolves_to_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let tracks = resolve_tracks(&dir.path().join("library.db"), &BTreeSet::from([1])).unwrap();
        assert!(tracks.is_empty());
    }

    #[test]
    fn stored_relative_paths_become_relative_to_the_playlists_folder() {
        assert_eq!(
            mirror_path("Daft Punk/Discovery/01 One More Time.m4a"),
            "../Music/Daft Punk/Discovery/01 One More Time.m4a"
        );
    }

    #[test]
    fn an_absolute_path_is_written_as_it_stands() {
        assert_eq!(mirror_path("/Volumes/Big/x.flac"), "/Volumes/Big/x.flac");
    }

    #[test]
    fn a_playlist_renders_as_extended_m3u() {
        let tracks = HashMap::from([(
            1,
            track("../Music/a.m4a", "One More Time", "Daft Punk", 320),
        )]);
        let files = plan(&[row(1, "Party", vec![1])], &tracks);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "Party.m3u8");
        assert_eq!(
            files[0].contents,
            "#EXTM3U\n#EXTINF:320,Daft Punk - One More Time\n../Music/a.m4a\n"
        );
    }

    #[test]
    fn membership_order_is_the_file_order() {
        let tracks = HashMap::from([
            (1, track("../Music/a.m4a", "A", "X", 1)),
            (2, track("../Music/b.m4a", "B", "X", 2)),
        ]);
        let files = plan(&[row(1, "Mix", vec![2, 1])], &tracks);
        let paths: Vec<&str> = files[0]
            .contents
            .lines()
            .filter(|line| !line.starts_with('#'))
            .collect();
        assert_eq!(paths, vec!["../Music/b.m4a", "../Music/a.m4a"]);
    }

    /// A playlist can hold an id whose file was deleted from the library.
    #[test]
    fn unresolved_ids_are_skipped_not_written_blank() {
        let tracks = HashMap::from([(1, track("../Music/a.m4a", "A", "X", 1))]);
        let files = plan(&[row(1, "Mix", vec![1, 99])], &tracks);
        assert_eq!(files[0].contents.lines().count(), 3);
    }

    #[test]
    fn an_empty_playlist_produces_no_file() {
        let files = plan(&[row(1, "Favorites", vec![])], &HashMap::new());
        assert!(files.is_empty());
    }

    #[test]
    fn a_playlist_whose_every_track_is_gone_produces_no_file() {
        let files = plan(&[row(1, "Mix", vec![99])], &HashMap::new());
        assert!(files.is_empty());
    }

    #[test]
    fn names_that_sanitize_alike_get_numbered() {
        let tracks = HashMap::from([(1, track("../Music/a.m4a", "A", "X", 1))]);
        let files = plan(
            &[row(1, "AC/DC", vec![1]), row(2, "AC:DC", vec![1])],
            &tracks,
        );
        assert_eq!(files[0].filename, "AC_DC.m3u8");
        assert_eq!(files[1].filename, "AC_DC (2).m3u8");
    }

    /// A newline in a title would turn the rest of it into a path line.
    #[test]
    fn newlines_in_tags_cannot_break_out_of_the_metadata_line() {
        let tracks = HashMap::from([(1, track("../Music/a.m4a", "Bad\n/etc/passwd", "X", 1))]);
        let files = plan(&[row(1, "Mix", vec![1])], &tracks);
        assert_eq!(files[0].contents.lines().count(), 3);
    }

    #[test]
    fn writing_creates_the_folder_and_the_files() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        write(
            &target,
            &[MirrorFile {
                filename: "Party.m3u8".into(),
                contents: "#EXTM3U\n".into(),
            }],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(target.join("Party.m3u8")).unwrap(),
            "#EXTM3U\n"
        );
    }

    #[test]
    fn nothing_to_mirror_does_not_create_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        write(&target, &[]).unwrap();
        assert!(!target.exists());
    }

    #[test]
    fn a_playlist_that_no_longer_exists_loses_its_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("Gone.m3u8"), "#EXTM3U\n").unwrap();
        write(
            &target,
            &[MirrorFile {
                filename: "Kept.m3u8".into(),
                contents: "#EXTM3U\n".into(),
            }],
        )
        .unwrap();
        assert!(!target.join("Gone.m3u8").exists());
        assert!(target.join("Kept.m3u8").exists());
    }

    #[test]
    fn the_sweep_leaves_everything_that_is_not_a_mirror_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("notes.txt"), "mine").unwrap();
        fs::write(target.join("old.m3u"), "mine too").unwrap();
        write(&target, &[]).unwrap();
        assert!(target.join("notes.txt").exists());
        assert!(target.join("old.m3u").exists());
    }

    /// The written file must survive its own sweep when the filesystem hands
    /// its name back under a different case.
    #[test]
    fn the_sweep_compares_names_without_case() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("PARTY.m3u8"), "#EXTM3U\n").unwrap();
        sweep(&target, &BTreeSet::from(["party.m3u8".to_string()])).unwrap();
        assert!(target.join("PARTY.m3u8").exists());
    }

    #[test]
    fn an_unchanged_file_is_not_rewritten() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Playlists");
        let file = MirrorFile {
            filename: "Party.m3u8".into(),
            contents: "#EXTM3U\n".into(),
        };
        write(&target, std::slice::from_ref(&file)).unwrap();
        let before = fs::metadata(target.join("Party.m3u8"))
            .unwrap()
            .modified()
            .unwrap();
        write(&target, &[file]).unwrap();
        let after = fs::metadata(target.join("Party.m3u8"))
            .unwrap()
            .modified()
            .unwrap();
        assert_eq!(before, after);
    }
}
