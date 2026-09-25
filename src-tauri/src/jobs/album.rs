//! The playlist pipeline: probe, per-track download and import, album-wide enrich.

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
    let Some(job) = snapshot(inner, id).await else {
        return;
    };

    update_job(app, inner, id, |j| j.status = JobStatus::Downloading).await;

    // Skipped on retry: the entries are persisted.
    if job.tracks.is_empty() {
        job_log(id, "━━ probe phase (playlist listing) ━━");
        let probe = match run_probe(app, &job.url).await {
            Ok(probe) => probe,
            Err(err) => {
                fail(app, inner, id, JobStep::Download, err).await;
                return;
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
            return;
        }
        let tracks = parse_probe_entries(&probe);
        if tracks.is_empty() {
            let err = AppError::Sidecar("probe returned no playable entries".into());
            fail(app, inner, id, JobStep::Download, err).await;
            return;
        }
        let as_string = |key: &str| probe.get(key).and_then(Value::as_str).map(str::to_string);
        update_job(app, inner, id, |j| {
            j.title = as_string("title");
            j.artist = as_string("artist");
            j.tracks = tracks;
        })
        .await;
    }

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
        if settle_cancel(app, inner, id).await {
            return;
        }
        if track.status == TrackStatus::Done {
            continue;
        }
        if track.item_id.is_some() {
            // Imported by a previous attempt.
            update_track(app, inner, id, track.index, |t| {
                t.status = TrackStatus::Imported;
            })
            .await;
            continue;
        }
        if let Some(path) = track
            .staged_path
            .as_ref()
            .filter(|p| std::path::Path::new(p).exists())
        {
            let _ = path;
            update_track(app, inner, id, track.index, |t| {
                t.status = TrackStatus::Downloaded;
            })
            .await;
            continue;
        }

        if downloaded_before && track_delay > 0.0 {
            let pause = track_delay * (1.0 + fastrand::f64() * TRACK_SLEEP_JITTER);
            tokio::time::sleep(Duration::from_secs_f64(pause)).await;
        }
        downloaded_before = true;

        update_track(app, inner, id, track.index, |t| {
            t.status = TrackStatus::Downloading;
        })
        .await;
        job_log(id, &format!("track {}/{total}", track.index));
        match download_with_retry(
            app,
            inner,
            id,
            &track.url,
            AttemptTarget::Track(track.index),
        )
        .await
        {
            Ok(result) => {
                let as_string =
                    |key: &str| result.get(key).and_then(Value::as_str).map(str::to_string);
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
                let gone = is_unavailable(&message);
                job_log(
                    id,
                    &format!(
                        "track {} marked {}",
                        track.index,
                        if gone { "unavailable" } else { "failed" }
                    ),
                );
                update_track(app, inner, id, track.index, |t| {
                    t.status = if gone {
                        TrackStatus::Unavailable
                    } else {
                        TrackStatus::Failed
                    };
                    t.error = Some(message);
                })
                .await;
            }
        }
    }

    if settle_cancel(app, inner, id).await {
        return;
    }

    // Singletons; enrich_album creates the album row.
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
        let Some(path) = track.staged_path.clone() else {
            continue;
        };
        job_log(id, &format!("importing track {}", track.index));
        match run_import(app, &path, true).await {
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
            Err(_) if cancel_requested(inner, id) => {
                if settle_cancel(app, inner, id).await {
                    return;
                }
            }
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

    if settle_cancel(app, inner, id).await {
        return;
    }

    let Some(job) = snapshot(inner, id).await else {
        return;
    };
    let item_ids: Vec<i64> = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Imported)
        .filter_map(|t| t.item_id)
        .collect();
    if !item_ids.is_empty() {
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
                    for entry in &reports {
                        let Some(item_id) = entry.get("item_id").and_then(Value::as_i64) else {
                            continue;
                        };
                        if let Some(track) =
                            j.tracks.iter_mut().find(|t| t.item_id == Some(item_id))
                        {
                            track.report = entry.get("report").cloned().filter(|r| !r.is_null());
                            track.duplicate_of = entry.get("duplicate_of").and_then(Value::as_i64);
                        }
                    }
                    for track in &mut j.tracks {
                        if track.status == TrackStatus::Imported {
                            track.status = TrackStatus::Done;
                        }
                    }
                })
                .await;
            }
            Err(err) => {
                // Tracks stay `Imported`, so a retry resumes at enrich.
                fail(app, inner, id, JobStep::Enrich, err).await;
                return;
            }
        }
    }

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

    let total = job.tracks.len();
    let failed = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Failed)
        .count();
    // Counted apart from `failed`: nothing to retry.
    let unavailable = job
        .tracks
        .iter()
        .filter(|t| t.status == TrackStatus::Unavailable)
        .count() as u32;
    if unavailable > 0 {
        job_log(
            id,
            &format!("{unavailable} of {total} track(s) no longer available at the source"),
        );
    }
    update_job(app, inner, id, |j| j.unavailable = unavailable).await;

    // `Failed` only when nothing could be produced. Some dead videos still make
    // the job `Done`, with the tally in `error`.
    if unavailable as usize == total {
        job_log(id, &format!("job FAILED: all {total} video(s) unavailable"));
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Failed;
            j.failed_step = Some(JobStep::Download);
            j.error = Some(format!("all {total} videos are no longer available"));
        })
        .await;
        return;
    }
    if failed == 0 {
        job_log(id, "job done");
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Done;
            j.error = None;
        })
        .await;
        return;
    }
    if failed == total {
        job_log(id, &format!("job FAILED: all {total} track(s) failed"));
        // The earliest failing phase.
        let step = if job
            .tracks
            .iter()
            .any(|t| t.status == TrackStatus::Failed && t.staged_path.is_none())
        {
            JobStep::Download
        } else {
            JobStep::Import
        };
        update_job(app, inner, id, |j| {
            j.status = JobStatus::Failed;
            j.failed_step = Some(step);
            j.error = Some(format!("{failed} of {total} tracks failed"));
        })
        .await;
        return;
    }
    job_log(
        id,
        &format!("job done with {failed}/{total} failed track(s)"),
    );
    update_job(app, inner, id, |j| {
        j.status = JobStatus::Done;
        j.failed_step = None;
        j.error = Some(format!("{failed} of {total} tracks failed"));
    })
    .await;
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
            eprintln!("[jobs] keychain read failed, enriching without AcoustID: {err}");
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
