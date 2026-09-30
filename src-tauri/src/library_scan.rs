//! Pre-import scan of a folder: how many tracks, how many playable, and how
//! much disk the copy will take. Read-only.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::audio_formats;
use crate::error::{AppError, AppResult};

/// Walk limit, so picking a home directory or a volume doesn't look like a
/// hang. Reaching it is reported (`truncated`).
const MAX_ENTRIES: u64 = 200_000;

const NAMED_UNPLAYABLE: usize = 5;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub playable: u64,
    /// Audio the engine can't decode (Opus, WMA…). Still imported.
    pub unplayable: u64,
    /// Lowercase, no dot. Ordered for stable output.
    pub unplayable_by_extension: BTreeMap<String, u64>,
    pub unplayable_examples: Vec<String>,
    /// Folders with at least one audio file: the import progress denominator,
    /// since beets reports per folder.
    pub album_folders: u64,
    /// Audio files in the fullest folder, used to suggest a grouping (a folder of
    /// forty tracks is unlikely to be one album).
    pub largest_folder: u64,
    pub bytes: u64,
    /// Hit `MAX_ENTRIES`: every count is a floor.
    pub truncated: bool,
    /// The last import overlapping this folder, if any. Re-importing is allowed
    /// (beets skips seen folders), but the UI should say so.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previously_imported: Option<PreviousImport>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviousImport {
    pub folder: String,
    pub finished_at: u64,
    pub cancelled: bool,
}

/// Leading dot, which beets ignores (`ignore_hidden`), e.g. `._Track.m4a`.
fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with('.'))
}

/// By the decoder's extension list; files without an extension don't count.
fn is_audio(path: &Path) -> bool {
    audio_formats::is_playable(&path.to_string_lossy()) || is_known_unplayable(path)
}

/// Audio formats recognised but not decodable.
const UNPLAYABLE_AUDIO: &[&str] = &[
    "opus", "wma", "ape", "wv", "mpc", "ra", "rm", "amr", "shn", "tta", "ofr", "dsf", "dff",
];

fn is_known_unplayable(path: &Path) -> bool {
    extension_of(path).is_some_and(|ext| UNPLAYABLE_AUDIO.contains(&ext.as_str()))
}

fn extension_of(path: &Path) -> Option<String> {
    path.extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
}

/// Refuses a folder overlapping the library in either direction: importing
/// the library into itself, or a parent that contains it.
pub fn ensure_outside_library(root: &Path, library: &Path) -> AppResult<()> {
    if root.starts_with(library) {
        return Err(AppError::InvalidInput(
            "that folder is inside the Sonarche library".into(),
        ));
    }
    if library.starts_with(root) {
        return Err(AppError::InvalidInput(
            "that folder contains the Sonarche library".into(),
        ));
    }
    Ok(())
}

/// Walks `root` (blocking) and reports what an import would find. Directory
/// symlinks are not followed.
pub fn scan(root: &Path) -> AppResult<ScanReport> {
    if !root.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "not a folder: {}",
            root.display()
        )));
    }

    let mut report = ScanReport {
        playable: 0,
        unplayable: 0,
        unplayable_by_extension: BTreeMap::new(),
        unplayable_examples: Vec::new(),
        album_folders: 0,
        largest_folder: 0,
        bytes: 0,
        truncated: false,
        previously_imported: None,
    };
    let mut seen: u64 = 0;
    let mut pending = vec![root.to_path_buf()];

    // Iterative: music trees can be deep.
    while let Some(dir) = pending.pop() {
        // An unreadable subtree costs only that subtree.
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        let mut in_this_folder: u64 = 0;

        for entry in entries.flatten() {
            seen += 1;
            if seen > MAX_ENTRIES {
                report.truncated = true;
                return Ok(report);
            }

            // `file_type` doesn't follow symlinks, so ancestor links can't loop.
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            let path = entry.path();

            if file_type.is_dir() {
                // beets skips hidden directories too (`.git`, `.Trashes`).
                if !is_hidden(&path) {
                    pending.push(path);
                }
                continue;
            }
            if !file_type.is_file() || is_hidden(&path) || !is_audio(&path) {
                continue;
            }

            in_this_folder += 1;
            report.bytes += entry.metadata().map(|meta| meta.len()).unwrap_or(0);
            record(&mut report, &path);
        }

        // Per folder: beets treats `Disc 1` and `Disc 2` as two folders.
        if in_this_folder > 0 {
            report.album_folders += 1;
            report.largest_folder = report.largest_folder.max(in_this_folder);
        }
    }

    Ok(report)
}

fn record(report: &mut ScanReport, path: &Path) {
    if audio_formats::is_playable(&path.to_string_lossy()) {
        report.playable += 1;
        return;
    }

    report.unplayable += 1;
    if let Some(ext) = extension_of(path) {
        *report.unplayable_by_extension.entry(ext).or_insert(0) += 1;
    }
    if report.unplayable_examples.len() < NAMED_UNPLAYABLE {
        report
            .unplayable_examples
            .push(path.to_string_lossy().into_owned());
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    struct Tree(PathBuf);

    impl Tree {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!("sonarche-scan-{name}"));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).expect("temp tree");
            Tree(root)
        }

        fn root_ref(&self) -> &PathBuf {
            &self.0
        }

        fn file(&self, relative: &str, bytes: usize) -> &Self {
            let path = self.0.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("parent");
            }
            fs::write(&path, vec![0u8; bytes]).expect("write");
            self
        }
    }

    impl Drop for Tree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn counts_audio_across_a_nested_library() {
        let tree = Tree::new("nested");
        tree.file("Daft Punk/Discovery/01 One More Night.m4a", 10)
            .file("Daft Punk/Discovery/02 Digital Love.flac", 20)
            .file("Radiohead/In Rainbows/01 Nude.mp3", 30);

        let report = scan(&tree.0).expect("scan");

        assert_eq!(report.playable, 3);
        assert_eq!(report.unplayable, 0);
        assert_eq!(report.bytes, 60);
        assert!(!report.truncated);
    }

    /// Only folders containing audio count, not their parents.
    #[test]
    fn counts_the_folders_beets_will_walk_not_the_ones_in_between() {
        let tree = Tree::new("folders");
        tree.file("Daft Punk/Discovery/01.m4a", 1)
            .file("Daft Punk/Discovery/02.m4a", 1)
            .file("Daft Punk/Homework/01.m4a", 1)
            .file("Radiohead/In Rainbows/Disc 1/01.m4a", 1)
            .file("Radiohead/In Rainbows/Disc 2/01.m4a", 1)
            .file("Radiohead/In Rainbows/cover.jpg", 1);

        let report = scan(&tree.0).expect("scan");

        assert_eq!(report.album_folders, 4);
    }

    #[test]
    fn reports_the_fullest_single_folder() {
        let tree = Tree::new("fullest");
        tree.file("Artist/Album/01.m4a", 1)
            .file("Artist/Album/02.m4a", 1)
            .file("Rips/a.mp3", 1)
            .file("Rips/b.mp3", 1)
            .file("Rips/c.mp3", 1);

        let report = scan(&tree.0).unwrap();

        assert_eq!(report.largest_folder, 3);
        assert_eq!(report.album_folders, 2);
    }

    #[test]
    fn separates_what_it_cannot_decode_and_says_which_formats() {
        let tree = Tree::new("mixed");
        tree.file("a/keeper.flac", 1)
            .file("a/voice.opus", 1)
            .file("b/old.wma", 1)
            .file("b/older.wma", 1);

        let report = scan(&tree.0).expect("scan");

        assert_eq!(report.playable, 1);
        assert_eq!(report.unplayable, 3);
        assert_eq!(report.unplayable_by_extension.get("wma"), Some(&2));
        assert_eq!(report.unplayable_by_extension.get("opus"), Some(&1));
        assert_eq!(report.unplayable_examples.len(), 3);
    }

    /// Covers and booklets are not tracks; hidden files are skipped like beets does.
    #[test]
    fn skips_what_beets_skips() {
        let tree = Tree::new("hidden");
        tree.file("Album/01.m4a", 1)
            .file("Album/._01.m4a", 1)
            .file(".Trashes/deleted.mp3", 1);

        let report = scan(tree.root_ref()).unwrap();

        assert_eq!(report.playable, 1);
        assert_eq!(report.album_folders, 1);
    }

    #[test]
    fn ignores_everything_that_is_not_audio() {
        let tree = Tree::new("clutter");
        tree.file("Album/01 Track.mp3", 5)
            .file("Album/cover.jpg", 900)
            .file("Album/booklet.pdf", 900)
            .file("Album/.DS_Store", 900)
            .file("Album/notes", 900);

        let report = scan(&tree.0).expect("scan");

        assert_eq!(report.playable, 1);
        assert_eq!(report.unplayable, 0);
        assert_eq!(report.bytes, 5);
    }

    #[test]
    fn a_file_is_not_a_folder() {
        let tree = Tree::new("notadir");
        tree.file("lonely.mp3", 1);

        let outcome = scan(&tree.0.join("lonely.mp3"));

        assert!(matches!(outcome, Err(AppError::InvalidInput(_))));
    }

    #[test]
    fn refuses_a_folder_that_overlaps_the_library_either_way() {
        let library = Path::new("/Users/me/Music/Sonarche");

        assert!(ensure_outside_library(library, library).is_err());
        assert!(ensure_outside_library(&library.join("Daft Punk"), library).is_err());
        assert!(ensure_outside_library(Path::new("/Users/me/Music"), library).is_err());
        assert!(ensure_outside_library(Path::new("/Users/me"), library).is_err());
    }

    #[test]
    fn allows_a_folder_that_merely_shares_a_prefix() {
        let library = Path::new("/Users/me/Music/Sonarche");

        // Same string prefix, different folder: compare path components.
        assert!(ensure_outside_library(Path::new("/Users/me/Music/Sonarche-old"), library).is_ok());
        assert!(ensure_outside_library(Path::new("/Volumes/Backup"), library).is_ok());
    }

    #[test]
    fn an_empty_folder_reports_nothing_rather_than_failing() {
        let tree = Tree::new("empty");

        let report = scan(&tree.0).expect("scan");

        assert_eq!(report.playable, 0);
        assert_eq!(report.bytes, 0);
    }
}
