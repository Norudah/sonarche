//! Look at a folder before importing it.
//!
//! Pointing the app at fifteen years of someone's music is not a step to take
//! blind — from the outside a folder is a name, and the difference between 40
//! tracks and 12 000 is the difference between a click and an afternoon. This
//! walks the tree and answers three questions the confirmation screen has to
//! ask: how much is in there, how much of it can we play, and how much disc it
//! will cost once copied.
//!
//! Reading only. Nothing here creates, moves or deletes a file — the import
//! itself is beets' job, and it copies.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::audio_formats;
use crate::error::{AppError, AppResult};

/// A ceiling on the walk, not on the import.
///
/// A folder chosen by mistake can be a home directory or a mounted volume, and
/// a walk that never ends is indistinguishable from a hang. Reaching it is
/// reported rather than swallowed, so the screen can say the count is a floor.
const MAX_ENTRIES: u64 = 200_000;

/// How many unplayable files are named back. Enough to recognise what they are,
/// short of pasting a wall of paths into a summary.
const NAMED_UNPLAYABLE: usize = 5;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    /// Files the engine can decode.
    pub playable: u64,
    /// Audio files it cannot — Opus, WMA, anything symphonia has no decoder
    /// for. Counted, not hidden: they are still imported, still tagged, and
    /// still part of their album.
    pub unplayable: u64,
    /// Unplayable counts by extension, lowercase and undotted. Ordered, so the
    /// summary reads the same twice.
    pub unplayable_by_extension: BTreeMap<String, u64>,
    /// A few unplayable files by name, for a screen that has to show rather
    /// than assert.
    pub unplayable_examples: Vec<String>,
    /// Folders holding at least one audio file.
    ///
    /// beets imports a tree folder by folder and names each one as it goes, so
    /// this is the denominator of the progress bar — the only count the import
    /// can be measured against without asking beets how far it has to go.
    pub album_folders: u64,
    /// Total bytes of every audio file found — what the copy will cost.
    pub bytes: u64,
    /// The walk hit `MAX_ENTRIES` and stopped. Every count above is a floor.
    pub truncated: bool,
}

/// Everything that is not audio: covers, logs, `.DS_Store`, the PDF booklet.
///
/// Judged by the same extension list the decoder uses, which means a file with
/// no extension is not audio here. That is the right answer for a scan: beets
/// will read the file's actual contents at import time, and a summary that
/// promised a track we cannot name is worse than one that missed it.
fn is_audio(path: &Path) -> bool {
    audio_formats::is_playable(&path.to_string_lossy()) || is_known_unplayable(path)
}

/// Audio formats we recognise by name but cannot decode. Not "everything that
/// is not playable": a `.jpg` is not a track we are declining to play.
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

/// Refuse a folder that overlaps the library, in either direction.
///
/// Both mistakes are easy to make from a file picker and neither is visible in
/// the result: importing the library into itself has beets copy every file
/// beside itself and re-import the copies, and importing a folder that
/// *contains* the library walks it too, re-importing everything already in.
///
/// Checked here rather than at each call site so the scan and the import that
/// follows it cannot disagree about what is allowed.
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

/// Walk `root` and report what an import would find.
///
/// Blocking on purpose: it is a directory walk, and the caller runs it on a
/// blocking thread. Directory symlinks are not followed — a link pointing at an
/// ancestor is a loop, and one pointing outside the folder is not something the
/// user asked to import.
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
        bytes: 0,
        truncated: false,
    };
    let mut seen: u64 = 0;
    let mut pending = vec![root.to_path_buf()];

    // Iterative rather than recursive: a deep tree is ordinary in a music
    // library (artist/album/disc), and the depth is the user's, not ours.
    while let Some(dir) = pending.pop() {
        // A folder we cannot read is not fatal — a permission-denied subtree in
        // someone's library should cost that subtree, not the whole scan.
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        let mut holds_audio = false;

        for entry in entries.flatten() {
            seen += 1;
            if seen > MAX_ENTRIES {
                report.truncated = true;
                return Ok(report);
            }

            // `file_type` does not follow symlinks, which is what keeps a link
            // to an ancestor from being walked forever.
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            let path = entry.path();

            if file_type.is_dir() {
                pending.push(path);
                continue;
            }
            if !file_type.is_file() || !is_audio(&path) {
                continue;
            }

            holds_audio = true;
            report.bytes += entry.metadata().map(|meta| meta.len()).unwrap_or(0);
            record(&mut report, &path);
        }

        // Counted per folder, not per file: an album spread over `Disc 1` and
        // `Disc 2` is two folders to beets, and both are named as it goes.
        if holds_audio {
            report.album_folders += 1;
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

    /// A throwaway tree under the OS temp dir, removed when the test ends.
    struct Tree(PathBuf);

    impl Tree {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!("sonarche-scan-{name}"));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).expect("temp tree");
            Tree(root)
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

    /// The progress denominator. Only folders with audio in them count — the
    /// artist folders above them hold nothing beets will announce.
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

        // Discovery, Homework, Disc 1, Disc 2 — not `Daft Punk`, not
        // `Radiohead`, and not `In Rainbows`, which holds only the cover.
        assert_eq!(report.album_folders, 4);
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

    /// A music folder is full of things that are not music. Counting the cover
    /// art as a track would make every summary wrong by an album's worth.
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
        // Only the track's bytes: the copy will not carry the booklet.
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

        // The library itself, and anything under it.
        assert!(ensure_outside_library(library, library).is_err());
        assert!(ensure_outside_library(&library.join("Daft Punk"), library).is_err());
        // A parent of it walks the library too.
        assert!(ensure_outside_library(Path::new("/Users/me/Music"), library).is_err());
        assert!(ensure_outside_library(Path::new("/Users/me"), library).is_err());
    }

    #[test]
    fn allows_a_folder_that_merely_shares_a_prefix() {
        let library = Path::new("/Users/me/Music/Sonarche");

        // `Sonarche-old` starts with the same *string* as the library but is a
        // different folder — a check on characters rather than path components
        // would refuse it.
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
