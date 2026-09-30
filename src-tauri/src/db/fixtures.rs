//! Rows for the tests of every table.

use serde_json::json;

use crate::jobs::{AlbumTrack, Job, JobKind, JobStatus, TrackStatus};
use crate::library_import::{ImportRecord, ImportStatus, ScanCounts};

pub fn single(id: &str, status: JobStatus) -> Job {
    Job {
        id: id.into(),
        url: "https://example.com/watch?v=abc".into(),
        kind: JobKind::Single,
        status,
        failed_step: None,
        error: None,
        title: Some("Song".into()),
        artist: Some("Artist".into()),
        thumbnail: None,
        duration: Some(212.5),
        staged_path: None,
        item_id: Some(42),
        report: Some(json!({ "item_id": 42, "completion": 0.8 })),
        tracks: Vec::new(),
        download_attempts: 1,
        category: Some("Video Games".into()),
        forced_album: None,
        single_album: true,
        unavailable: 0,
        undone_at: None,
        created_at: 1000,
        updated_at: 1000,
    }
}

pub fn track(index: u32, status: TrackStatus) -> AlbumTrack {
    AlbumTrack {
        index,
        video_id: format!("vid{index}"),
        url: format!("https://example.com/watch?v=vid{index}"),
        title: Some(format!("Track {index}")),
        duration: Some(180.0),
        status,
        error: None,
        staged_path: None,
        item_id: Some(index as i64),
        report: Some(json!({ "index": index })),
        duplicate_of: None,
        download_attempts: 2,
    }
}

pub fn import(id: &str, finished_at: u64) -> ImportRecord {
    ImportRecord {
        id: id.to_string(),
        folder: "/Volumes/Backup/Music".to_string(),
        status: ImportStatus::Done,
        error: None,
        scan: ScanCounts {
            playable: 4287,
            unplayable: 25,
            unplayable_by_extension: [("wma".to_string(), 19u64), ("opus".to_string(), 6)].into(),
            bytes: 31_400_000_000,
            album_folders: 312,
        },
        folders: 312,
        renditions: 40,
        grouping: Some("tracks".to_string()),
        category: Some("Video Games".to_string()),
        recap: Some(json!({ "tracks": 4312, "withoutGenre": 96 })),
        undone_at: None,
        finished_at,
    }
}
