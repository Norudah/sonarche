//! Downloads: one `jobs` row each, plus `job_tracks` for an album.

use rusqlite::{params, Connection, OptionalExtension, Row};

use super::{enum_from_text, enum_to_text, report_from_text, report_to_text};
use crate::error::{AppError, AppResult};
use crate::jobs::{AlbumTrack, Job};

fn row_to_job(row: &Row) -> AppResult<Job> {
    Ok(Job {
        id: row.get("id")?,
        url: row.get("url")?,
        kind: enum_from_text(&row.get::<_, String>("kind")?)?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        failed_step: row
            .get::<_, Option<String>>("failed_step")?
            .map(|s| enum_from_text(&s))
            .transpose()?,
        error: row.get("error")?,
        title: row.get("title")?,
        artist: row.get("artist")?,
        thumbnail: row.get("thumbnail")?,
        duration: row.get("duration")?,
        staged_path: row.get("staged_path")?,
        item_id: row.get("item_id")?,
        report: report_from_text(row.get("report")?)?,
        tracks: Vec::new(),
        download_attempts: row.get::<_, i64>("download_attempts")? as u32,
        category: row.get("category")?,
        forced_album: row
            .get::<_, Option<String>>("forced_album")?
            .map(|text| serde_json::from_str(&text))
            .transpose()
            .map_err(|e| AppError::Sidecar(format!("bad forced_album json: {e}")))?,
        single_album: row.get::<_, i64>("single_album")? != 0,
        unavailable: row.get::<_, i64>("unavailable")? as u32,
        undone_at: row.get::<_, Option<i64>>("undone_at")?.map(|at| at as u64),
        created_at: row.get::<_, i64>("created_at")? as u64,
        updated_at: row.get::<_, i64>("updated_at")? as u64,
    })
}

fn row_to_track(row: &Row) -> AppResult<AlbumTrack> {
    Ok(AlbumTrack {
        index: row.get::<_, i64>("idx")? as u32,
        video_id: row.get("video_id")?,
        url: row.get("url")?,
        title: row.get("title")?,
        duration: row.get("duration")?,
        status: enum_from_text(&row.get::<_, String>("status")?)?,
        error: row.get("error")?,
        staged_path: row.get("staged_path")?,
        item_id: row.get("item_id")?,
        report: report_from_text(row.get("report")?)?,
        duplicate_of: row.get("duplicate_of")?,
        download_attempts: row.get::<_, i64>("download_attempts")? as u32,
    })
}

fn write_job_row(conn: &Connection, job: &Job) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO jobs (
            id, url, kind, status, failed_step, error, title, artist, thumbnail,
            duration, staged_path, item_id, report, download_attempts, category,
            forced_album, single_album, unavailable, undone_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
        params![
            job.id,
            job.url,
            enum_to_text(&job.kind)?,
            enum_to_text(&job.status)?,
            job.failed_step.map(|s| enum_to_text(&s)).transpose()?,
            job.error,
            job.title,
            job.artist,
            job.thumbnail,
            job.duration,
            job.staged_path,
            job.item_id,
            report_to_text(&job.report)?,
            job.download_attempts as i64,
            job.category,
            job.forced_album
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|e| AppError::Sidecar(format!("forced_album not serializable: {e}")))?,
            job.single_album as i64,
            job.unavailable as i64,
            job.undone_at.map(|at| at as i64),
            job.created_at as i64,
            job.updated_at as i64,
        ],
    )?;
    Ok(())
}

fn write_track_row(conn: &Connection, job_id: &str, track: &AlbumTrack) -> AppResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO job_tracks (
            job_id, idx, video_id, url, title, duration, status, error,
            staged_path, item_id, report, duplicate_of, download_attempts
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            job_id,
            track.index as i64,
            track.video_id,
            track.url,
            track.title,
            track.duration,
            enum_to_text(&track.status)?,
            track.error,
            track.staged_path,
            track.item_id,
            report_to_text(&track.report)?,
            track.duplicate_of,
            track.download_attempts as i64,
        ],
    )?;
    Ok(())
}

/// Writes a job and all its tracks in one transaction.
pub fn upsert_job(conn: &Connection, job: &Job) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    write_job_row(&tx, job)?;
    tx.execute("DELETE FROM job_tracks WHERE job_id = ?1", params![job.id])?;
    for track in &job.tracks {
        write_track_row(&tx, &job.id, track)?;
    }
    tx.commit()?;
    Ok(())
}

/// Writes one track plus the job's `updated_at` (album download hot path).
pub fn update_track(
    conn: &Connection,
    job_id: &str,
    updated_at: u64,
    track: &AlbumTrack,
) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    write_track_row(&tx, job_id, track)?;
    tx.execute(
        "UPDATE jobs SET updated_at = ?2 WHERE id = ?1",
        params![job_id, updated_at as i64],
    )?;
    tx.commit()?;
    Ok(())
}

fn load_tracks(conn: &Connection, job_id: &str) -> AppResult<Vec<AlbumTrack>> {
    let mut stmt = conn.prepare("SELECT * FROM job_tracks WHERE job_id = ?1 ORDER BY idx ASC")?;
    let rows = stmt.query_map(params![job_id], |row| Ok(row_to_track(row)))?;
    let mut tracks = Vec::new();
    for row in rows {
        tracks.push(row??);
    }
    Ok(tracks)
}

pub fn get_job(conn: &Connection, id: &str) -> AppResult<Option<Job>> {
    let mut job = conn
        .query_row("SELECT * FROM jobs WHERE id = ?1", params![id], |row| {
            Ok(row_to_job(row))
        })
        .optional()?
        .transpose()?;
    if let Some(job) = job.as_mut() {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    Ok(job)
}

const TERMINAL_STATUSES: &str = "('done', 'failed', 'cancelled')";

/// Finished jobs listed alongside the live queue.
pub const LIVE_TERMINAL_WINDOW: u32 = 50;

/// Every unfinished job, however old, plus the most recent finished ones,
/// newest first.
pub fn list_live_jobs(conn: &Connection, recent_terminal: u32) -> AppResult<Vec<Job>> {
    let sql = format!(
        "SELECT * FROM jobs
         WHERE status NOT IN {TERMINAL_STATUSES}
            OR id IN (SELECT id FROM jobs WHERE status IN {TERMINAL_STATUSES}
                      ORDER BY created_at DESC LIMIT ?1)
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![recent_terminal], |row| Ok(row_to_job(row)))?;
    let mut jobs = Vec::new();
    for row in rows {
        jobs.push(row??);
    }
    for job in &mut jobs {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    Ok(jobs)
}

/// One page of the archive (all statuses, newest first) with its totals.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobsPage {
    pub jobs: Vec<Job>,
    /// All jobs, live included.
    pub total: u64,
    /// Finished jobs only: what "clear history" removes.
    pub terminal_total: u64,
}

pub fn list_jobs_page(conn: &Connection, offset: u64, limit: u64) -> AppResult<JobsPage> {
    let mut stmt =
        conn.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?1 OFFSET ?2")?;
    let rows = stmt.query_map(params![limit, offset], |row| Ok(row_to_job(row)))?;
    let mut jobs = Vec::new();
    for row in rows {
        jobs.push(row??);
    }
    for job in &mut jobs {
        job.tracks = load_tracks(conn, &job.id)?;
    }
    let total = conn.query_row("SELECT COUNT(*) FROM jobs", [], |row| row.get::<_, i64>(0))? as u64;
    let terminal_total = conn.query_row(
        &format!("SELECT COUNT(*) FROM jobs WHERE status IN {TERMINAL_STATUSES}"),
        [],
        |row| row.get::<_, i64>(0),
    )? as u64;
    Ok(JobsPage {
        jobs,
        total,
        terminal_total,
    })
}

/// Marks a download as undone; the row keeps its status and tracks.
pub fn mark_job_undone(conn: &Connection, id: &str, when: u64) -> AppResult<()> {
    conn.execute(
        "UPDATE jobs SET undone_at = ?2, updated_at = ?2 WHERE id = ?1",
        params![id, when as i64],
    )?;
    Ok(())
}

/// Startup recovery: fails jobs left running and resets tracks caught
/// downloading. Returns whether anything changed.
pub fn fail_interrupted(conn: &Connection, now: u64) -> AppResult<bool> {
    let jobs = conn.execute(
        "UPDATE jobs SET status = 'failed', error = 'interrupted by app restart', updated_at = ?1
         WHERE status NOT IN ('done', 'failed', 'cancelled')",
        params![now as i64],
    )?;
    conn.execute(
        "UPDATE job_tracks SET status = 'pending' WHERE status = 'downloading'",
        [],
    )?;
    Ok(jobs > 0)
}

pub fn import_jobs(conn: &Connection, jobs: &[Job]) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    for job in jobs {
        write_job_row(&tx, job)?;
        for track in &job.tracks {
            write_track_row(&tx, &job.id, track)?;
        }
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::{single, track};
    use crate::db::open_in_memory_for_tests as mem;
    use crate::jobs::{ForcedAlbum, JobKind, JobStatus, JobStep, TrackStatus};
    use serde_json::json;

    #[test]
    fn a_forced_album_survives_the_round_trip() {
        let conn = mem();
        let mut job = single("forced", JobStatus::Queued);
        job.forced_album = Some(ForcedAlbum {
            title: "Inception".into(),
            artist: Some("Hans Zimmer".into()),
            album_id: None,
        });
        upsert_job(&conn, &job).unwrap();

        let read = list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .pop()
            .unwrap();
        let forced = read.forced_album.expect("forced album lost in the store");
        assert_eq!(forced.title, "Inception");
        assert_eq!(forced.artist.as_deref(), Some("Hans Zimmer"));
    }

    #[test]
    fn a_job_written_before_forced_albums_reads_back_without_one() {
        let conn = mem();
        upsert_job(&conn, &single("plain", JobStatus::Queued)).unwrap();

        assert!(list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .pop()
            .unwrap()
            .forced_album
            .is_none());
    }

    #[test]
    fn round_trips_a_single_job_with_report() {
        let conn = mem();
        let job = single("a", JobStatus::Done);
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "a").unwrap().unwrap();
        assert_eq!(read.status, JobStatus::Done);
        assert_eq!(read.item_id, Some(42));
        assert_eq!(read.duration, Some(212.5));
        assert_eq!(read.report, job.report);
        assert!(read.tracks.is_empty());
    }

    #[test]
    fn round_trips_album_tracks_in_order() {
        let conn = mem();
        let mut job = single("b", JobStatus::Enriching);
        job.kind = JobKind::Album;
        job.failed_step = None;
        job.tracks = vec![
            track(1, TrackStatus::Done),
            track(2, TrackStatus::Imported),
            track(3, TrackStatus::Failed),
        ];
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "b").unwrap().unwrap();
        assert_eq!(read.kind, JobKind::Album);
        let indices: Vec<u32> = read.tracks.iter().map(|t| t.index).collect();
        assert_eq!(indices, vec![1, 2, 3]);
        assert_eq!(read.tracks[1].status, TrackStatus::Imported);
        assert_eq!(read.tracks[2].report, Some(json!({ "index": 3 })));
    }

    #[test]
    fn failed_step_survives_the_round_trip() {
        let conn = mem();
        let mut job = single("c", JobStatus::Failed);
        job.failed_step = Some(JobStep::Enrich);
        job.error = Some("boom".into());
        upsert_job(&conn, &job).unwrap();

        let read = get_job(&conn, "c").unwrap().unwrap();
        assert_eq!(read.failed_step, Some(JobStep::Enrich));
        assert_eq!(read.error.as_deref(), Some("boom"));
    }

    #[test]
    fn update_track_touches_one_row_and_bumps_updated_at() {
        let conn = mem();
        let mut job = single("d", JobStatus::Downloading);
        job.kind = JobKind::Album;
        job.tracks = vec![
            track(1, TrackStatus::Pending),
            track(2, TrackStatus::Pending),
        ];
        upsert_job(&conn, &job).unwrap();

        let mut t2 = track(2, TrackStatus::Downloaded);
        t2.staged_path = Some("/tmp/2.m4a".into());
        update_track(&conn, "d", 2000, &t2).unwrap();

        let read = get_job(&conn, "d").unwrap().unwrap();
        assert_eq!(read.updated_at, 2000);
        assert_eq!(read.tracks[0].status, TrackStatus::Pending);
        assert_eq!(read.tracks[1].status, TrackStatus::Downloaded);
        assert_eq!(read.tracks[1].staged_path.as_deref(), Some("/tmp/2.m4a"));
    }

    #[test]
    fn fail_interrupted_only_touches_in_flight() {
        let conn = mem();
        let mut running = single("e", JobStatus::Downloading);
        running.kind = JobKind::Album;
        running.tracks = vec![
            track(1, TrackStatus::Downloading),
            track(2, TrackStatus::Done),
        ];
        upsert_job(&conn, &running).unwrap();
        upsert_job(&conn, &single("f", JobStatus::Done)).unwrap();
        upsert_job(&conn, &single("f2", JobStatus::Cancelled)).unwrap();

        assert!(fail_interrupted(&conn, 3000).unwrap());

        let e = get_job(&conn, "e").unwrap().unwrap();
        assert_eq!(e.status, JobStatus::Failed);
        assert_eq!(e.updated_at, 3000);
        assert_eq!(e.tracks[0].status, TrackStatus::Pending);
        assert_eq!(e.tracks[1].status, TrackStatus::Done);

        let f = get_job(&conn, "f").unwrap().unwrap();
        assert_eq!(f.status, JobStatus::Done);

        let f2 = get_job(&conn, "f2").unwrap().unwrap();
        assert_eq!(f2.status, JobStatus::Cancelled);
    }

    #[test]
    fn list_jobs_is_newest_first() {
        let conn = mem();
        let mut older = single("old", JobStatus::Done);
        older.created_at = 100;
        let mut newer = single("new", JobStatus::Done);
        newer.created_at = 200;
        upsert_job(&conn, &older).unwrap();
        upsert_job(&conn, &newer).unwrap();

        let ids: Vec<String> = list_live_jobs(&conn, LIVE_TERMINAL_WINDOW)
            .unwrap()
            .into_iter()
            .map(|j| j.id)
            .collect();
        assert_eq!(ids, vec!["new".to_string(), "old".to_string()]);
    }

    #[test]
    fn live_window_keeps_old_active_jobs_and_drops_old_terminal_ones() {
        let conn = mem();
        let mut ancient_active = single("ancient-active", JobStatus::Queued);
        ancient_active.created_at = 1;
        upsert_job(&conn, &ancient_active).unwrap();
        for i in 0..4u64 {
            let mut done = single(&format!("done-{i}"), JobStatus::Done);
            done.created_at = 100 + i;
            upsert_job(&conn, &done).unwrap();
        }

        let ids: Vec<String> = list_live_jobs(&conn, 2)
            .unwrap()
            .into_iter()
            .map(|j| j.id)
            .collect();
        assert_eq!(
            ids,
            vec![
                "done-3".to_string(),
                "done-2".to_string(),
                "ancient-active".to_string()
            ]
        );
    }

    #[test]
    fn jobs_page_slices_newest_first_and_reports_totals() {
        let conn = mem();
        for i in 0..7u64 {
            let status = if i == 0 {
                JobStatus::Queued
            } else {
                JobStatus::Done
            };
            let mut job = single(&format!("job-{i}"), status);
            job.created_at = 100 + i;
            upsert_job(&conn, &job).unwrap();
        }

        let first = list_jobs_page(&conn, 0, 3).unwrap();
        assert_eq!(first.total, 7);
        assert_eq!(first.terminal_total, 6);
        let ids: Vec<String> = first.jobs.into_iter().map(|j| j.id).collect();
        assert_eq!(
            ids,
            vec![
                "job-6".to_string(),
                "job-5".to_string(),
                "job-4".to_string()
            ]
        );

        let last = list_jobs_page(&conn, 6, 3).unwrap();
        assert_eq!(last.jobs.len(), 1);
        assert_eq!(last.jobs[0].id, "job-0");

        let past_the_end = list_jobs_page(&conn, 30, 3).unwrap();
        assert!(past_the_end.jobs.is_empty());
        assert_eq!(past_the_end.total, 7);
    }

    /// `upsert_job` writes every column; the undo stamp must survive it.
    #[test]
    fn a_job_marked_undone_stays_undone() {
        let conn = mem();
        let job = single("j", JobStatus::Done);
        upsert_job(&conn, &job).unwrap();
        assert_eq!(get_job(&conn, "j").unwrap().unwrap().undone_at, None);

        mark_job_undone(&conn, "j", 500).unwrap();

        let reloaded = get_job(&conn, "j").unwrap().unwrap();
        assert_eq!(reloaded.undone_at, Some(500));
        assert_eq!(reloaded.updated_at, 500);
        upsert_job(&conn, &reloaded).unwrap();
        assert_eq!(get_job(&conn, "j").unwrap().unwrap().undone_at, Some(500));
    }
}
