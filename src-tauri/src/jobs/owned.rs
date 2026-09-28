//! Which of a job's item ids still name what it filed. beets recycles rowids
//! (an emptied library restarts at 1), so an old job's id can point at another
//! record; undo and re-filing must never act on it. The front applies the same
//! rule to what it shows (`features/download/queue/library.ts`).

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde_json::Value;

use super::model::{Job, JobKind};
use crate::error::{AppError, AppResult};

/// An item id with the tags the job's report recorded for it.
#[derive(Debug, Clone, PartialEq)]
struct FiledItem {
    id: i64,
    title: Option<String>,
    album: Option<String>,
}

fn tag(report: Option<&Value>, key: &str) -> Option<String> {
    report?
        .get(key)?
        .as_str()
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
}

/// Album tracks minus dropped duplicates, or the single's item.
fn filed_items(job: &Job) -> Vec<FiledItem> {
    let item = |id: i64, report: Option<&Value>| FiledItem {
        id,
        title: tag(report, "title"),
        album: tag(report, "album"),
    };
    match job.kind {
        JobKind::Album => job
            .tracks
            .iter()
            .filter(|track| track.duplicate_of.is_none())
            .filter_map(|track| Some(item(track.item_id?, track.report.as_ref())))
            .collect(),
        JobKind::Single => job
            .item_id
            .map(|id| item(id, job.report.as_ref()))
            .into_iter()
            .collect(),
    }
}

fn same(expected: &Option<String>, actual: &str) -> bool {
    expected
        .as_ref()
        .is_none_or(|value| value.trim().to_lowercase() == actual.trim().to_lowercase())
}

/// One of title or album must still match: a retitle or a move changes only
/// one. Reports older than the stored tags pass.
fn is_still_ours(item: &FiledItem, title: &str, album: &str) -> bool {
    if item.title.is_none() && item.album.is_none() {
        return true;
    }
    (item.title.is_some() && same(&item.title, title))
        || (item.album.is_some() && same(&item.album, album))
}

fn owned_ids(beets_db: &Path, items: &[FiledItem]) -> AppResult<Vec<i64>> {
    if items.is_empty() || !beets_db.exists() {
        return Ok(Vec::new());
    }
    let conn = Connection::open_with_flags(
        beets_db,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )?;
    let mut stmt = conn.prepare("SELECT title, album FROM items WHERE id = ?1")?;
    let mut owned = Vec::new();
    for item in items {
        let mut rows = stmt.query([item.id])?;
        if let Some(row) = rows.next()? {
            let title = row.get::<_, Option<String>>(0)?.unwrap_or_default();
            let album = row.get::<_, Option<String>>(1)?.unwrap_or_default();
            if is_still_ours(item, &title, &album) {
                owned.push(item.id);
            }
        }
    }
    Ok(owned)
}

/// The job's items still in the library as it filed them. Reads beets'
/// database read-only, off the async runtime.
pub async fn owned_item_ids(beets_db: PathBuf, job: &Job) -> AppResult<Vec<i64>> {
    let items = filed_items(job);
    tokio::task::spawn_blocking(move || owned_ids(&beets_db, &items))
        .await
        .map_err(|err| AppError::Sidecar(format!("beets read task panicked: {err}")))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::{single, track};
    use crate::jobs::{JobStatus, TrackStatus};
    use serde_json::json;

    fn filed(id: i64, title: &str, album: &str) -> FiledItem {
        FiledItem {
            id,
            title: Some(title.into()),
            album: Some(album.into()),
        }
    }

    fn beets_db_with(rows: &[(i64, &str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let conn = Connection::open(dir.path().join("library.db")).unwrap();
        conn.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT, album TEXT)",
            [],
        )
        .unwrap();
        for (id, title, album) in rows {
            conn.execute(
                "INSERT INTO items (id, title, album) VALUES (?, ?, ?)",
                rusqlite::params![id, title, album],
            )
            .unwrap();
        }
        dir
    }

    #[test]
    fn filed_items_skip_duplicates_and_carry_the_report_tags() {
        let mut album = single("a", JobStatus::Done);
        album.kind = JobKind::Album;
        album.item_id = None;
        album.tracks = vec![
            track(1, TrackStatus::Done),
            track(2, TrackStatus::Done),
            track(3, TrackStatus::Failed),
        ];
        album.tracks[0].report = Some(json!({ "title": "Vantablack", "album": "New Model" }));
        album.tracks[1].duplicate_of = Some(7);
        album.tracks[2].item_id = None;

        assert_eq!(
            filed_items(&album),
            vec![filed(1, "Vantablack", "New Model")]
        );
    }

    #[test]
    fn a_single_is_its_own_item() {
        let job = single("s", JobStatus::Done);
        assert_eq!(
            filed_items(&job),
            vec![FiledItem {
                id: 42,
                title: None,
                album: None
            }]
        );
    }

    #[test]
    fn one_matching_tag_is_enough_and_case_does_not_count() {
        let item = filed(1, "Vantablack", "New Model");
        assert!(is_still_ours(&item, "vantablack ", "Renamed"));
        assert!(is_still_ours(&item, "Retitled", "NEW MODEL"));
        assert!(!is_still_ours(&item, "Le Perv", "Trilogy"));
    }

    #[test]
    fn a_report_without_tags_trusts_the_id() {
        let item = FiledItem {
            id: 1,
            title: None,
            album: None,
        };
        assert!(is_still_ours(&item, "Anything", "Anywhere"));
    }

    /// The history bug: the library was emptied, re-filled, and the old
    /// download's ids now name another album. Undo would have deleted it.
    #[test]
    fn recycled_and_missing_ids_are_dropped() {
        let dir = beets_db_with(&[(28, "Le Perv", "Trilogy"), (29, "Vantablack", "New Model")]);
        let items = [
            filed(28, "Birth of the New Model", "New Model"),
            filed(29, "Vantablack", "New Model"),
            filed(30, "God Complex", "New Model"),
        ];

        assert_eq!(
            owned_ids(&dir.path().join("library.db"), &items).unwrap(),
            vec![29]
        );
    }
}
