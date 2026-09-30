//! The playlist pipeline: probe, per-track download and import, album-wide enrich.

use std::ops::ControlFlow;
use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::preferences;
use crate::python_env::{self, AppPaths};
use crate::settings;
use crate::sidecar::SidecarState;

use super::download::{download_with_retry, is_unavailable, AttemptTarget};
use super::filing::{apply_category, apply_destination, run_import};
use super::model::{AlbumTrack, Job, JobKind, JobStatus, JobStep, TrackStatus};
use super::single::run_single_job;
use super::{
    cancel_requested, fail, job_log, settle_cancel, snapshot, update_job, update_track, JobsInner,
};

const PROBE_TIMEOUT: Duration = Duration::from_secs(3 * 60);

/// Covers the whole album: fingerprints, MusicBrainz calls and covers.
const ENRICH_ALBUM_TIMEOUT: Duration = Duration::from_secs(20 * 60);

/// Up to 2x jitter on the configured delay, so requests don't look scripted.
const TRACK_SLEEP_JITTER: f64 = 1.0;

const MAX_ALBUM_TRACKS: u64 = 100;

fn parse_probe_entries(probe: &Value) -> Vec<AlbumTrack> {
    let Some(entries) = probe.get("entries").and_then(Value::as_array) else {
        return Vec::new();
    };
    entries
        .iter()
        .enumerate()
        .filter_map(|(i, entry)| {
            let url = entry.get("url").and_then(Value::as_str)?.to_string();
            Some(AlbumTrack {
                index: (i + 1) as u32,
                video_id: entry
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                url,
                title: entry
                    .get("title")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                duration: entry.get("duration").and_then(Value::as_f64),
                status: TrackStatus::Pending,
                error: None,
                staged_path: None,
                item_id: None,
                report: None,
                duplicate_of: None,
                download_attempts: 0,
            })
        })
        .collect()
}

/// Album pipeline: probe the playlist, then download and import each track
/// through the same sidecar calls as a single job (per-track timeouts and
/// resume). Enrich is one album-wide request so a single release is matched.
pub(super) async fn run_album_job(app: &AppHandle, inner: &JobsInner, id: &str) {
    let _ = run_phases(app, inner, id).await;
}

/// Each phase breaks once the job has ended: failed, cancelled, or handed over.
async fn run_phases(app: &AppHandle, inner: &JobsInner, id: &str) -> ControlFlow<()> {
    let Some(job) = snapshot(inner, id).await else {
        return ControlFlow::Break(());
    };
    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;
    // Skipped on retry: the entries are persisted.
    if job.tracks.is_empty() {
        probe_phase(app, inner, id, &job.url).await?;
    }
    download_phase(app, inner, id).await?;
    import_phase(app, inner, id).await?;
    enrich_phase(app, inner, id).await?;
    finish(app, inner, id).await;
    ControlFlow::Continue(())
}

async fn stop_if_cancelled(app: &AppHandle, inner: &JobsInner, id: &str) -> ControlFlow<()> {
    if settle_cancel(app, inner, id).await {
        ControlFlow::Break(())
    } else {
        ControlFlow::Continue(())
    }
}

async fn probe_phase(app: &AppHandle, inner: &JobsInner, id: &str, url: &str) -> ControlFlow<()> {
    job_log(id, "━━ probe phase (playlist listing) ━━");
    let probe = match run_probe(app, url).await {
        Ok(probe) => probe,
        Err(err) => {
            fail(app, inner, id, JobStep::Download, err).await;
            return ControlFlow::Break(());
        }
    };
    let is_playlist = probe
        .get("is_playlist")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !is_playlist {
        // Empty playlist or plain video: fall back to the single pipeline.
        update_job(app, inner, id, |j| j.kind = JobKind::Single).await;
        run_single_job(app, inner, id).await;
        return ControlFlow::Break(());
    }
    let tracks = parse_probe_entries(&probe);
    if tracks.is_empty() {
        let err = AppError::Sidecar("probe returned no playable entries".into());
        fail(app, inner, id, JobStep::Download, err).await;
        return ControlFlow::Break(());
    }
    let as_string = |key: &str| probe.get(key).and_then(Value::as_str).map(str::to_string);
    update_job(app, inner, id, |j| {
        j.title = as_string("title");
        j.artist = as_string("artist");
        j.tracks = tracks;
    })
    .await;
    ControlFlow::Continue(())
}

/// Where a track left by a previous attempt resumes, when it needs no download.
fn resumed_status(track: &AlbumTrack) -> Option<TrackStatus> {
    if track.status == TrackStatus::Done {
        return Some(TrackStatus::Done);
    }
    if track.item_id.is_some() {
        return Some(TrackStatus::Imported);
    }
    let staged = track
        .staged_path
        .as_deref()
        .is_some_and(|path| Path::new(path).exists());
    staged.then_some(TrackStatus::Downloaded)
}

async fn download_phase(app: &AppHandle, inner: &JobsInner, id: &str) -> ControlFlow<()> {
    job_log(id, "━━ download phase ━━");
    let tracks = snapshot(inner, id)
        .await
        .map(|j| j.tracks)
        .unwrap_or_default();
    let total = tracks.len();
    let track_delay = preferences::load(app)
        .await
        .unwrap_or_default()
        .download_delay_seconds;
    let mut downloaded_before = false;
    for track in &tracks {
        stop_if_cancelled(app, inner, id).await?;
        if let Some(status) = resumed_status(track) {
            if status != track.status {
                update_track(app, inner, id, track.index, |t| t.status = status).await;
            }
            continue;
        }
        if downloaded_before && track_delay > 0.0 {
            let pause = track_delay * (1.0 + fastrand::f64() * TRACK_SLEEP_JITTER);
            tokio::time::sleep(Duration::from_secs_f64(pause)).await;
        }
        downloaded_before = true;
        job_log(id, &format!("track {}/{total}", track.index));
        download_track(app, inner, id, track).await;
    }
    stop_if_cancelled(app, inner, id).await
}

async fn download_track(app: &AppHandle, inner: &JobsInner, id: &str, track: &AlbumTrack) {
    update_track(app, inner, id, track.index, |t| {
        t.status = TrackStatus::Downloading;
    })
    .await;
    let target = AttemptTarget::Track(track.index);
    match download_with_retry(app, inner, id, &track.url, target).await {
        Ok(result) => {
            let as_string = |key: &str| result.get(key).and_then(Value::as_str).map(str::to_string);
            update_track(app, inner, id, track.index, |t| {
                t.staged_path = as_string("path");
                if let Some(title) = as_string("title") {
                    t.title = Some(title);
                }
                t.duration = result
                    .get("duration")
                    .and_then(Value::as_f64)
                    .or(t.duration);
                t.status = TrackStatus::Downloaded;
            })
            .await;
            // The first video's thumbnail is the fallback cover for a forced album.
            if let Some(thumbnail) = as_string("thumbnail") {
                update_job(app, inner, id, |j| {
                    j.thumbnail.get_or_insert(thumbnail);
                })
                .await;
            }
        }
        // Interrupted by a stop: back to pending for a future retry.
        Err(_) if cancel_requested(inner, id) => {
            update_track(app, inner, id, track.index, |t| {
                t.status = TrackStatus::Pending;
                t.error = None;
            })
            .await;
        }
        Err(err) => {
            // One dead video must not sink the album.
            let message = err.to_string();
            let status = if is_unavailable(&message) {
                TrackStatus::Unavailable
            } else {
                TrackStatus::Failed
            };
            job_log(id, &format!("track {} marked {status:?}", track.index));
            update_track(app, inner, id, track.index, |t| {
                t.status = status;
                t.error = Some(message);
            })
            .await;
        }
    }
}

/// Imports as singletons; `enrich_album` creates the album row.
async fn import_phase(app: &AppHandle, inner: &JobsInner, id: &str) -> ControlFlow<()> {
    job_log(id, "━━ import phase ━━");
    update_job(app, inner, id, |j| j.status = JobStatus::Importing).await;
    let tracks = snapshot(inner, id)
        .await
        .map(|j| j.tracks)
        .unwrap_or_default();
    for track in &tracks {
        if track.status != TrackStatus::Downloaded {
            continue;
        }
        let Some(path) = track.staged_path.as_deref() else {
            continue;
        };
        job_log(id, &format!("importing track {}", track.index));
        match run_import(app, path, true).await {
            Ok(result) => {
                let item_id = result.pointer("/report/item_id").and_then(Value::as_i64);
                let report = result.get("report").cloned().filter(|r| !r.is_null());
                update_track(app, inner, id, track.index, |t| {
                    t.item_id = item_id;
                    t.report = report;
                    // No item id: duplicate skipped by beets.
                    t.status = if item_id.is_some() {
                        TrackStatus::Imported
                    } else {
                        TrackStatus::Done
                    };
                })
                .await;
            }
            // Interrupted by a stop; the staged file is intact.
            Err(_) if cancel_requested(inner, id) => stop_if_cancelled(app, inner, id).await?,
            Err(err) => {
                let message = err.to_string();
                update_track(app, inner, id, track.index, |t| {
                    t.status = TrackStatus::Failed;
                    t.error = Some(message);
                })
                .await;
            }
        }
    }
    stop_if_cancelled(app, inner, id).await
}

async fn enrich_phase(app: &AppHandle, inner: &JobsInner, id: &str) -> ControlFlow<()> {
    let Some(job) = snapshot(inner, id).await else {
        return ControlFlow::Break(());
    };
    let item_ids: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Imported)
        .filter_map(|t| t.item_id)
        .collect();
    if item_ids.is_empty() {
        return ControlFlow::Continue(());
    }
    job_log(
        id,
        &format!("━━ metadata phase ({} item(s)) ━━", item_ids.len()),
    );
    update_job(app, inner, id, |j| j.status = JobStatus::Enriching).await;
    match run_enrich_album(app, &job, &item_ids).await {
        Ok(result) => {
            let reports = result
                .get("reports")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            update_job(app, inner, id, |j| {
                apply_enrich_reports(&mut j.tracks, &reports)
            })
            .await;
            ControlFlow::Continue(())
        }
        Err(err) => {
            // Tracks stay `Imported`, so a retry resumes at enrich.
            fail(app, inner, id, JobStep::Enrich, err).await;
            ControlFlow::Break(())
        }
    }
}

fn apply_enrich_reports(tracks: &mut [AlbumTrack], reports: &[Value]) {
    for entry in reports {
        let Some(item_id) = entry.get("item_id").and_then(Value::as_i64) else {
            continue;
        };
        if let Some(track) = tracks.iter_mut().find(|t| t.item_id == Some(item_id)) {
            track.report = entry.get("report").cloned().filter(|r| !r.is_null());
            track.duplicate_of = entry.get("duplicate_of").and_then(Value::as_i64);
        }
    }
    for track in tracks {
        if track.status == TrackStatus::Imported {
            track.status = TrackStatus::Done;
        }
    }
}

/// Files the kept tracks, then writes the job's final status.
async fn finish(app: &AppHandle, inner: &JobsInner, id: &str) {
    let Some(job) = snapshot(inner, id).await else {
        return;
    };
    let kept: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.duplicate_of.is_none())
        .filter_map(|t| t.item_id)
        .collect();
    if let Some(category) = job.category.as_deref() {
        apply_category(app, id, category, &kept).await;
    }
    // Only an existing target: a new forced album was created by enrich.
    if let Some(forced) = job
        .forced_album
        .as_ref()
        .filter(|forced| forced.album_id.is_some())
    {
        apply_destination(app, id, forced, &kept, job.artist.as_deref()).await;
    }

    let outcome = album_outcome(&job.tracks);
    if outcome.unavailable > 0 {
        job_log(
            id,
            &format!(
                "{} of {} track(s) no longer available at the source",
                outcome.unavailable,
                job.tracks.len()
            ),
        );
    }
    job_log(id, &outcome.log);
    update_job(app, inner, id, |j| {
        j.unavailable = outcome.unavailable;
        j.status = outcome.status;
        j.failed_step = outcome.failed_step;
        j.error = outcome.error;
    })
    .await;
}

#[derive(Debug, PartialEq)]
struct Outcome {
    status: JobStatus,
    failed_step: Option<JobStep>,
    error: Option<String>,
    /// Counted apart from failures: nothing to retry.
    unavailable: u32,
    log: String,
}

/// `Failed` only when nothing could be produced. Some dead videos still make
/// the job `Done`, with the tally in `error`.
fn album_outcome(tracks: &[AlbumTrack]) -> Outcome {
    let total = tracks.len();
    let count = |status: TrackStatus| tracks.iter().filter(|t| t.status == status).count();
    let failed = count(TrackStatus::Failed);
    let unavailable = count(TrackStatus::Unavailable);
    let tally = format!("{failed} of {total} tracks failed");
    let (status, failed_step, error, log) = if unavailable == total {
        (
            JobStatus::Failed,
            Some(JobStep::Download),
            Some(format!("all {total} videos are no longer available")),
            format!("job FAILED: all {total} video(s) unavailable"),
        )
    } else if failed == 0 {
        (JobStatus::Done, None, None, "job done".to_string())
    } else if failed == total {
        // The earliest failing phase.
        let step = if tracks
            .iter()
            .any(|t| t.status == TrackStatus::Failed && t.staged_path.is_none())
        {
            JobStep::Download
        } else {
            JobStep::Import
        };
        (
            JobStatus::Failed,
            Some(step),
            Some(tally),
            format!("job FAILED: all {total} track(s) failed"),
        )
    } else {
        (
            JobStatus::Done,
            None,
            Some(tally),
            format!("job done with {failed}/{total} failed track(s)"),
        )
    };
    Outcome {
        status,
        failed_step,
        error,
        unavailable: unavailable as u32,
        log,
    }
}

async fn run_probe(app: &AppHandle, url: &str) -> AppResult<Value> {
    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "probe",
            json!({ "url": url, "max_entries": MAX_ALBUM_TRACKS }),
            PROBE_TIMEOUT,
        )
        .await
}

async fn run_enrich_album(app: &AppHandle, job: &Job, item_ids: &[i64]) -> AppResult<Value> {
    let paths = AppPaths::resolve(app)?;
    python_env::ensure_fpcalc(&paths).await?;

    // The key goes from the keychain to the sidecar, never through the webview.
    let acoustid_key = match settings::read("acoustid").await {
        Ok(key) => key,
        Err(err) => {
            log_line!("[jobs] keychain read failed, enriching without AcoustID: {err}");
            None
        }
    };
    let prefs = preferences::load(app).await?;

    let track_hints: Vec<Value> = job
        .tracks
        .iter()
        .filter(|t| t.item_id.is_some())
        .map(|t| {
            json!({
                "item_id": t.item_id,
                "index": t.index,
                "title": t.title,
                "duration": t.duration,
            })
        })
        .collect();

    // An existing target is handled afterwards by `apply_destination`.
    let forced_album = job
        .forced_album
        .as_ref()
        .filter(|forced| forced.album_id.is_none())
        .map(|forced| {
            json!({
                "title": forced.title,
                "artist": forced.artist,
                "category": job.category,
                "thumbnail": job.thumbnail,
            })
        });

    let sidecar = app.state::<SidecarState>();
    sidecar
        .request(
            app,
            "enrich_album",
            json!({
                "item_ids": item_ids,
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "fpcalc": paths.fpcalc().to_string_lossy(),
                "acoustid_key": acoustid_key,
                "album_title": job.title,
                "artist": job.artist,
                "forced_album": forced_album,
                "single_album": job.single_album,
                "category": job.category,
                "thumbnail": job.thumbnail,
                "track_hints": track_hints,
                "fetch_pause_seconds": prefs.lastfm_fetch_delay_seconds,
                "lookup_pause_seconds": prefs.acoustid_lookup_delay_seconds,
            }),
            ENRICH_ALBUM_TIMEOUT,
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(index: u32, status: TrackStatus) -> AlbumTrack {
        AlbumTrack {
            index,
            video_id: format!("v{index}"),
            url: format!("https://example.test/{index}"),
            title: None,
            duration: None,
            status,
            error: None,
            staged_path: None,
            item_id: None,
            report: None,
            duplicate_of: None,
            download_attempts: 0,
        }
    }

    #[test]
    fn probe_entries_without_a_url_are_dropped_and_indexes_follow_the_listing() {
        let probe = json!({ "entries": [
            { "url": "https://a", "id": "a", "title": "A", "duration": 61.0 },
            { "id": "no-url" },
            { "url": "https://c" },
        ] });
        let tracks = parse_probe_entries(&probe);
        assert_eq!(tracks.len(), 2);
        assert_eq!(
            (tracks[0].index, tracks[0].title.as_deref()),
            (1, Some("A"))
        );
        assert_eq!((tracks[1].index, tracks[1].video_id.as_str()), (3, ""));
    }

    #[test]
    fn a_track_resumes_past_what_a_previous_attempt_finished() {
        assert_eq!(
            resumed_status(&track(1, TrackStatus::Done)),
            Some(TrackStatus::Done)
        );
        let mut imported = track(1, TrackStatus::Failed);
        imported.item_id = Some(7);
        assert_eq!(resumed_status(&imported), Some(TrackStatus::Imported));

        let staged = tempfile::NamedTempFile::new().unwrap();
        let mut downloaded = track(1, TrackStatus::Pending);
        downloaded.staged_path = Some(staged.path().to_string_lossy().into_owned());
        assert_eq!(resumed_status(&downloaded), Some(TrackStatus::Downloaded));
    }

    #[test]
    fn a_vanished_staged_file_means_downloading_again() {
        let mut gone = track(1, TrackStatus::Downloaded);
        gone.staged_path = Some("/nonexistent/sonarche/staged.m4a".into());
        assert_eq!(resumed_status(&gone), None);
    }

    #[test]
    fn enrich_reports_land_on_their_items_and_close_the_imported_tracks() {
        let mut tracks = vec![
            track(1, TrackStatus::Imported),
            track(2, TrackStatus::Failed),
        ];
        tracks[0].item_id = Some(10);
        let reports = vec![json!({ "item_id": 10, "report": { "ok": true }, "duplicate_of": 4 })];
        apply_enrich_reports(&mut tracks, &reports);
        assert_eq!(tracks[0].status, TrackStatus::Done);
        assert_eq!(tracks[0].duplicate_of, Some(4));
        assert_eq!(tracks[0].report, Some(json!({ "ok": true })));
        assert_eq!(tracks[1].status, TrackStatus::Failed);
    }

    #[test]
    fn a_clean_album_is_done() {
        let outcome = album_outcome(&[track(1, TrackStatus::Done), track(2, TrackStatus::Done)]);
        assert_eq!(outcome.status, JobStatus::Done);
        assert_eq!((outcome.failed_step, outcome.error), (None, None));
    }

    #[test]
    fn dead_videos_alone_do_not_fail_the_album() {
        let outcome = album_outcome(&[
            track(1, TrackStatus::Done),
            track(2, TrackStatus::Unavailable),
        ]);
        assert_eq!(outcome.status, JobStatus::Done);
        assert_eq!(outcome.unavailable, 1);
        assert_eq!(outcome.error, None);
    }

    #[test]
    fn an_album_of_dead_videos_fails_at_download() {
        let outcome = album_outcome(&[
            track(1, TrackStatus::Unavailable),
            track(2, TrackStatus::Unavailable),
        ]);
        assert_eq!(outcome.status, JobStatus::Failed);
        assert_eq!(outcome.failed_step, Some(JobStep::Download));
    }

    #[test]
    fn some_failures_finish_the_job_with_a_tally() {
        let outcome = album_outcome(&[track(1, TrackStatus::Done), track(2, TrackStatus::Failed)]);
        assert_eq!(outcome.status, JobStatus::Done);
        assert_eq!(outcome.error.as_deref(), Some("1 of 2 tracks failed"));
    }

    #[test]
    fn all_failed_points_at_the_earliest_failing_phase() {
        let mut staged = track(2, TrackStatus::Failed);
        staged.staged_path = Some("/staged.m4a".into());
        let at_import = album_outcome(std::slice::from_ref(&staged));
        assert_eq!(at_import.failed_step, Some(JobStep::Import));

        let at_download = album_outcome(&[track(1, TrackStatus::Failed), staged]);
        assert_eq!(at_download.status, JobStatus::Failed);
        assert_eq!(at_download.failed_step, Some(JobStep::Download));
    }
}
