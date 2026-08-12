use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::genres::RecomputeGenresState;
use crate::identity;
use crate::import_undo;
use crate::jobs::{ForcedAlbum, Job, JobKind, JobsState};
use crate::library_align::LibraryAlignState;
use crate::library_import::{ImportOutcome, ImportRecord, LibraryImportState};
use crate::library_move;
use crate::library_scan::{self, ScanReport};
use crate::lyrics;
use crate::now_playing::{self, NowPlayingTrack};
use crate::onboarding::{self, OnboardingState};
use crate::player::{self, PlaybackStatus, PlayerState};
use crate::preferences::{self, Preferences};
use crate::python_env::{self, AppPaths, EnvStatus};
use crate::reenrich::ReenrichState;
use crate::remux::RemuxState;
use crate::reset::{self, ResetTargets};
use crate::settings::{self, ApiKeyStatus};
use crate::sidecar::SidecarState;
use crate::window_chrome;

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// Bound on the category a download may carry. Generous next to the taxonomy's
/// longest entry ("Video Games"); it exists so a pasted essay never reaches the
/// tag writer.
const MAX_CATEGORY_CHARS: usize = 100;

/// Bound on a forced album's title and artist. Same reasoning as the category —
/// both land in a tag on every file the job writes — with the headroom real
/// soundtrack names need ("… Original Motion Picture Soundtrack").
const MAX_ALBUM_CHARS: usize = 300;

#[tauri::command]
pub async fn get_env_status(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::env_status(&app).await
}

#[tauri::command]
pub async fn setup_env(app: AppHandle) -> AppResult<EnvStatus> {
    python_env::setup_env(&app).await
}

#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, JobsState>,
    url: String,
    kind: Option<JobKind>,
    category: Option<String>,
    forced_album: Option<ForcedAlbum>,
) -> AppResult<Job> {
    let parsed =
        url::Url::parse(&url).map_err(|_| AppError::InvalidInput("not a valid URL".into()))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "only http(s) URLs are allowed".into(),
        ));
    }
    // Free text on purpose, like the metadata editor's own category field: the
    // taxonomy the UI offers is a starter set, not a fence. Only the bounds are
    // enforced, since this string ends up in a tag on every file the job writes.
    let category = match category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
    {
        Some(c) if c.chars().count() > MAX_CATEGORY_CHARS => {
            return Err(AppError::InvalidInput("category is too long".into()))
        }
        other => other,
    };
    // A forced album with no title is the toggle left on over an empty field —
    // "no forced album", not a rejected download.
    let forced_album = match forced_album {
        Some(forced) => {
            let title = forced.title.trim().to_string();
            let artist = forced
                .artist
                .map(|a| a.trim().to_string())
                .filter(|a| !a.is_empty());
            if forced.album_id.is_some_and(|id| id <= 0) {
                return Err(AppError::InvalidInput("invalid target album".into()));
            }
            if title.is_empty() {
                None
            } else if title.chars().count() > MAX_ALBUM_CHARS
                || artist
                    .as_ref()
                    .is_some_and(|a| a.chars().count() > MAX_ALBUM_CHARS)
            {
                return Err(AppError::InvalidInput(
                    "forced album name is too long".into(),
                ));
            } else {
                Some(ForcedAlbum {
                    title,
                    artist,
                    album_id: forced.album_id,
                })
            }
        }
        None => None,
    };
    state
        .enqueue(
            &app,
            url,
            kind.unwrap_or(JobKind::Single),
            category,
            forced_album,
        )
        .await
}

#[tauri::command]
pub async fn list_jobs(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.list().await)
}

/// One page of the whole download archive, newest first. The limit is clamped
/// rather than trusted — it is a UI constant, not something to validate a
/// conversation over.
#[tauri::command]
pub async fn list_jobs_page(
    state: State<'_, JobsState>,
    offset: u64,
    limit: u64,
) -> AppResult<crate::jobs_store::JobsPage> {
    state.page(offset, limit.clamp(1, 100)).await
}

/// The albums a download still in flight is bound for — the library's delete
/// guard reads this. Deliberately a command of its own rather than something
/// the frontend derives from `list_jobs`: the library must not have to know the
/// shape of a job to refuse to delete its destination.
#[tauri::command]
pub async fn download_target_albums(state: State<'_, JobsState>) -> AppResult<Vec<i64>> {
    Ok(state.target_albums().await)
}

#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, JobsState>, id: String) -> AppResult<Job> {
    state.retry(&app, &id).await
}

#[tauri::command]
pub async fn cancel_job(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    id: String,
) -> AppResult<Job> {
    state.cancel(&app, &sidecar, &id).await
}

#[tauri::command]
pub async fn clear_job_history(state: State<'_, JobsState>) -> AppResult<Vec<Job>> {
    Ok(state.clear_history().await)
}

/// Look at a folder the user is considering importing.
///
/// Read-only, and off the runtime: a music library is a deep tree and
/// `read_dir` is blocking.
#[tauri::command]
pub async fn scan_import_folder(
    app: AppHandle,
    state: State<'_, LibraryImportState>,
    jobs: State<'_, JobsState>,
    path: String,
) -> AppResult<ScanReport> {
    let root = PathBuf::from(&path);
    library_scan::ensure_outside_library(&root, &AppPaths::resolve(&app)?.library_root)?;

    let scanned = root.clone();
    let mut report = tokio::task::spawn_blocking(move || library_scan::scan(&scanned))
        .await
        .map_err(|err| AppError::Sidecar(format!("scan task panicked: {err}")))??;

    // Read after the walk rather than in it: the archive is ours, the walk is
    // the disk's, and only one of the two belongs on a blocking thread.
    report.previously_imported =
        crate::library_import::overlapping_import(&jobs.list_imports().await, &root).map(
            |record| library_scan::PreviousImport {
                cancelled: matches!(
                    record.status,
                    crate::library_import::ImportStatus::Cancelled
                ),
                folder: record.folder,
                finished_at: record.finished_at,
            },
        );

    // Kept so the import that follows can be archived with the counts this
    // process measured, rather than with counts handed back by the page.
    state.remember_scan(&root, &report).await;
    Ok(report)
}

/// Copy a folder's music into the library. Takes as long as it takes; progress
/// reaches the page through the sidecar's own `library_import_progress` events.
#[tauri::command]
pub async fn start_library_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    state: State<'_, LibraryImportState>,
    folder: String,
    grouping: Option<String>,
    category: Option<String>,
) -> AppResult<ImportOutcome> {
    let grouping = grouping.unwrap_or_else(|| "folder".into());
    // Same bound and same freedom as the download path: the taxonomy the UI
    // offers is a starter set, not a fence, but this string lands in a tag on
    // every file the run takes on.
    let category = match category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
    {
        Some(c) if c.chars().count() > MAX_CATEGORY_CHARS => {
            return Err(AppError::InvalidInput("category is too long".into()))
        }
        other => other,
    };
    state
        .run(
            &app,
            &sidecar,
            &jobs,
            &folder,
            &grouping,
            category.as_deref(),
        )
        .await
}

/// Every finished library import, newest first. The archive of the other way
/// music enters the ark.
#[tauri::command]
pub async fn list_imports(jobs: State<'_, JobsState>) -> AppResult<Vec<ImportRecord>> {
    Ok(jobs.list_imports().await)
}

/// Stop the import in flight. The import itself resolves as cancelled through
/// its own call — this only plants the signal.
#[tauri::command]
pub async fn cancel_library_import(state: State<'_, LibraryImportState>) -> AppResult<()> {
    state.cancel().await
}

/// What undoing this run would take away. Counted from the library as it
/// stands, so the confirmation states a fact rather than repeating what the
/// run reported months ago.
#[tauri::command]
pub async fn preview_import_undo(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: String,
) -> AppResult<import_undo::UndoPreview> {
    import_undo::preview(&app, &sidecar, &jobs, &id).await
}

/// Take one import back out: its tracks, their files, the albums that empty,
/// their covers, the playlist entries, and beets' memory of the folder.
#[tauri::command]
pub async fn undo_import(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    imports: State<'_, LibraryImportState>,
    id: String,
) -> AppResult<import_undo::UndoOutcome> {
    import_undo::run(&app, &sidecar, &jobs, &imports, &id).await
}

#[tauri::command]
pub async fn list_api_keys() -> AppResult<Vec<ApiKeyStatus>> {
    settings::list().await
}

#[tauri::command]
pub async fn set_api_key(name: String, value: String) -> AppResult<ApiKeyStatus> {
    settings::set(name, value).await
}

/// Extensions the engine can decode, so the library can mark what it cannot.
/// A constant for the life of the build — the caller caches it forever.
#[tauri::command]
pub fn playable_extensions() -> Vec<String> {
    crate::audio_formats::playable_extensions()
}

#[tauri::command]
pub async fn list_library(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> AppResult<Box<RawValue>> {
    let paths = AppPaths::resolve(&app)?;
    // The read channel: the listing is what the UI blocks on, and it must not
    // wait out an album download running on the work channel.
    state
        .read(
            &app,
            "library_list",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
            }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn reenrich_track(
    app: AppHandle,
    state: State<'_, ReenrichState>,
    id: i64,
) -> AppResult<Value> {
    let result = state.run(&app, id).await?;
    // Re-enriching rewrites the tags, and beets files by tags: the track may
    // have just moved out from under every M3U line naming it.
    crate::playlists_mirror::sync_after_library_change(&app).await;
    Ok(result)
}

/// Repair pass over the library: remux fragmented DASH m4a files (downloads
/// made before ffmpeg shipped) into classic MP4s. Fired by the shell once per
/// launch; a library with nothing to repair answers in seconds.
#[tauri::command]
pub async fn remux_library(app: AppHandle, state: State<'_, RemuxState>) -> AppResult<Value> {
    state.run(&app).await
}

/// Play a library file now, replacing whatever was queued. Returns the decoded
/// duration in seconds — the engine's own reading of the file, which is what
/// the seek bar should trust.
///
/// Like every command here it runs through `off_runtime`: each one waits on the
/// audio thread, and the runtime's threads are not the ones to wait on it.
#[tauri::command]
pub async fn player_load(app: AppHandle, path: String) -> AppResult<Option<f64>> {
    player::ensure_in_library(&path, &AppPaths::resolve(&app)?.music_dir())?;
    player::off_runtime(app, move |player| player.load(&path)).await
}

/// Queue a file behind the playing one, for a seamless hand-over. The front
/// calls this once it knows what comes next.
#[tauri::command]
pub async fn player_enqueue(app: AppHandle, path: String) -> AppResult<()> {
    player::ensure_in_library(&path, &AppPaths::resolve(&app)?.music_dir())?;
    player::off_runtime(app, move |player| player.enqueue(&path)).await
}

#[tauri::command]
pub async fn player_toggle(app: AppHandle) -> AppResult<bool> {
    player::off_runtime(app, |player| player.toggle()).await
}

#[tauri::command]
pub async fn player_pause(app: AppHandle) -> AppResult<()> {
    player::off_runtime(app, |player| player.pause()).await
}

#[tauri::command]
pub async fn player_seek(app: AppHandle, seconds: f64) -> AppResult<()> {
    if !seconds.is_finite() {
        return Err(AppError::InvalidInput("seek target is not a number".into()));
    }
    player::off_runtime(app, move |player| player.seek(seconds)).await
}

/// `level` is the slider position, 0…1; the engine applies the audio taper.
#[tauri::command]
pub async fn player_set_volume(app: AppHandle, level: f64) -> AppResult<()> {
    if !level.is_finite() {
        return Err(AppError::InvalidInput("volume is not a number".into()));
    }
    player::off_runtime(app, move |player| player.set_volume(level as f32)).await
}

#[tauri::command]
pub async fn player_stop(app: AppHandle) -> AppResult<()> {
    player::off_runtime(app, |player| player.stop()).await
}

/// Tell the OS what is playing — media keys, Control Center, the lock screen.
/// The front owns this because a track is more than the file path the engine
/// was handed.
#[tauri::command]
pub async fn now_playing_set(app: AppHandle, track: NowPlayingTrack) -> AppResult<()> {
    now_playing::set_track(&app, &track);
    Ok(())
}

/// The current playhead, for a front that just mounted and missed the events.
#[tauri::command]
pub async fn player_status(state: State<'_, PlayerState>) -> AppResult<PlaybackStatus> {
    Ok(state.status())
}

#[tauri::command]
pub async fn get_preferences(app: AppHandle) -> AppResult<Preferences> {
    preferences::load(&app).await
}

#[tauri::command]
pub async fn set_rate_limit_delay(
    app: AppHandle,
    key: String,
    seconds: f64,
) -> AppResult<Preferences> {
    preferences::set_rate_limit_delay(&app, &key, seconds).await
}

#[tauri::command]
pub async fn recompute_genres(
    app: AppHandle,
    state: State<'_, RecomputeGenresState>,
) -> AppResult<Value> {
    state.run(&app).await
}

/// One track's lyrics. With `allow_network` false it answers from the library
/// alone — what the panel does on open — so the network is only ever reached by
/// the user pressing "Chercher les paroles". `force` is the panel's "look
/// again": it skips what is stored rather than erasing it.
#[tauri::command]
pub async fn fetch_lyrics(
    app: AppHandle,
    id: i64,
    allow_network: bool,
    force: bool,
) -> AppResult<Value> {
    lyrics::fetch(&app, id, allow_network, force).await
}

/// Walk the albums without a MusicBrainz identity and return the fill plan.
/// Writes nothing; the plan comes back through `library_align_apply`.
#[tauri::command]
pub async fn library_align_scan(
    app: AppHandle,
    state: State<'_, LibraryAlignState>,
) -> AppResult<Value> {
    state.scan(&app).await
}

/// Apply a plan produced by the scan. The sidecar re-checks every field
/// against its whitelist and its blank/hand-edited guards at write time.
#[tauri::command]
pub async fn library_align_apply(
    app: AppHandle,
    state: State<'_, LibraryAlignState>,
    plan: Value,
) -> AppResult<Value> {
    let result = state.apply(&app, plan).await?;
    crate::playlists_mirror::sync_after_library_change(&app).await;
    Ok(result)
}

/// Check an AcoustID key, so a typo is caught while the user still has the key
/// on screen rather than on the first failed download. Through the sidecar
/// because that is where the HTTP client already lives — and by then the engine
/// step is done, so the venv is guaranteed to be there.
///
/// `key` omitted means "the one already stored": the settings screen has a
/// Test button next to a key it is not allowed to read back, so the keychain
/// lookup has to happen on this side. The secret still never crosses the IPC
/// boundary outward.
#[tauri::command]
pub async fn check_acoustid_key(
    app: AppHandle,
    state: State<'_, SidecarState>,
    key: Option<String>,
) -> AppResult<Box<RawValue>> {
    let key = match key {
        Some(typed) if !typed.trim().is_empty() => typed,
        _ => settings::read("acoustid").await?.unwrap_or_default(),
    };
    state
        .read(
            &app,
            "acoustid_key_check",
            json!({ "key": key }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Ask every outside service whether it is answering. Through the sidecar for
/// the same reason as the key check: that is where the HTTP client lives, and
/// the probes run in parallel there so six timeouts cannot add up.
#[tauri::command]
pub async fn check_services(
    app: AppHandle,
    state: State<'_, SidecarState>,
    only: Option<String>,
) -> AppResult<Box<RawValue>> {
    let identity = identity::user_agent(&app);
    state
        .read(
            &app,
            "services_check",
            json!({ "only": only, "user_agent": identity }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn get_onboarding_state(app: AppHandle) -> AppResult<OnboardingState> {
    onboarding::state(&app).await
}

#[tauri::command]
pub async fn set_onboarding_completed(
    app: AppHandle,
    completed: bool,
) -> AppResult<OnboardingState> {
    onboarding::set_completed(&app, completed).await
}

#[tauri::command]
pub async fn get_library_location(app: AppHandle) -> AppResult<library_move::LibraryLocation> {
    library_move::location(&app)
}

/// What a move to `parent` would involve, and whether it can go ahead at all.
/// The confirmation dialog is built from this; the move itself re-checks.
#[tauri::command]
pub async fn check_library_move(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    parent: String,
) -> AppResult<library_move::MoveCheck> {
    library_move::check(&app, &jobs, PathBuf::from(parent)).await
}

/// Move the music to `parent`/Sonarche. Stops playback and takes the sidecar
/// down first; refuses outright while a download or an import is running.
#[tauri::command]
pub async fn move_library(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    parent: String,
) -> AppResult<library_move::LibraryLocation> {
    library_move::perform(&app, &jobs, &sidecar, PathBuf::from(parent)).await
}

/// The danger zone's destructive half: everything the user put in. Refuses
/// while a download or an import is running.
#[tauri::command]
pub async fn erase_all_data(
    app: AppHandle,
    jobs: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::erase_data(&app, &jobs, &sidecar).await
}

/// The danger zone's harmless half: the Python environment and the tools, both
/// of which the walkthrough puts back.
#[tauri::command]
pub async fn reinstall_environment(
    app: AppHandle,
    sidecar: State<'_, SidecarState>,
) -> AppResult<()> {
    reset::reinstall_environment(&app, &sidecar).await
}

/// Dev-only: put back what the app can rebuild by itself. Never the library.
#[tauri::command]
pub async fn reset_setup_dev(
    app: AppHandle,
    state: State<'_, JobsState>,
    sidecar: State<'_, SidecarState>,
    targets: ResetTargets,
) -> AppResult<()> {
    reset::reset_setup(&app, &state, &sidecar, targets).await
}

/// Dev-only: wipe the whole music library (audio files + beets DB) so bug-fix
/// scenarios restart from a clean slate. Refused outright in release builds.
#[tauri::command]
pub async fn reset_library_dev(app: AppHandle) -> AppResult<()> {
    reset::reset_library(&app).await
}

/// The only tags an edit may touch. Keys are beets' own item attribute names,
/// so the whitelist doubles as the wire contract with the sidecar.
const EDITABLE_FIELDS: &[&str] = &[
    "title",
    "artist",
    "albumartist",
    "album",
    "year",
    "track",
    "tracktotal",
    "genre",
    // The category axis (context: Video Games, Film, …), beets' grouping tag.
    "grouping",
];

#[derive(Deserialize)]
pub struct TrackUpdate {
    id: i64,
    fields: HashMap<String, Value>,
}

/// Edit metadata on a batch of tracks in one sidecar round-trip. The whole
/// batch is validated before any write is attempted, so a single stray field
/// name rejects the request rather than half-applying it.
#[tauri::command]
pub async fn update_tracks(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    updates: Vec<TrackUpdate>,
) -> AppResult<Value> {
    if updates.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }
    let mut wire = Vec::with_capacity(updates.len());
    for update in &updates {
        if update.fields.is_empty() {
            continue;
        }
        for key in update.fields.keys() {
            if !EDITABLE_FIELDS.contains(&key.as_str()) {
                return Err(AppError::InvalidInput(format!("unknown field: {key}")));
            }
        }
        wire.push(json!({ "id": update.id, "fields": update.fields }));
    }
    if wire.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_update",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "updates": wire,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    // The write is the one moment old and new albumartist are both known: any
    // rename it reported takes the artist's image (our asset, keyed by name)
    // along. Best-effort — the edit itself already succeeded.
    crate::artist_images::follow_renames(&app, &jobs, &result).await;
    // An edit that changed artist or album moved the file, and every M3U line
    // naming it is now a dead path.
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

/// The two things a record can be. Validated here rather than trusted from the
/// webview: this crosses the IPC boundary, and the sidecar would otherwise be
/// asked to write whatever string arrived.
const ALBUM_KINDS: &[&str] = &["album", "collection"];

/// A brand-new record to gather the moved tracks into.
#[derive(Deserialize)]
pub struct NewAlbum {
    album: String,
    albumartist: String,
}

/// One move request, whole: what goes where, as what, numbered how.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveSpec {
    /// Order matters: it is the numbering order when `renumber` is on.
    item_ids: Vec<i64>,
    target_album_id: Option<i64>,
    new_album: Option<NewAlbum>,
    kind: Option<String>,
    #[serde(default)]
    renumber: bool,
}

/// Refile tracks onto another record — existing (`target_album_id`) or created
/// on the spot (`new_album`). `kind` optionally declares the target's nature in
/// the same pass; `renumber` stacks the arrivals after the target's own track
/// numbers.
#[tauri::command]
pub async fn move_tracks(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    spec: MoveSpec,
) -> AppResult<Value> {
    if spec.item_ids.is_empty() {
        return Err(AppError::InvalidInput("no tracks to move".into()));
    }
    if spec.target_album_id.is_some() == spec.new_album.is_some() {
        return Err(AppError::InvalidInput(
            "need exactly one of target_album_id and new_album".into(),
        ));
    }
    let new_album = spec
        .new_album
        .map(|target| {
            let album = target.album.trim().to_string();
            let albumartist = target.albumartist.trim().to_string();
            if album.is_empty() || albumartist.is_empty() {
                return Err(AppError::InvalidInput(
                    "a new album needs a title and an artist".into(),
                ));
            }
            Ok(json!({ "album": album, "albumartist": albumartist }))
        })
        .transpose()?;
    if let Some(kind) = spec.kind.as_deref() {
        if !ALBUM_KINDS.contains(&kind) {
            return Err(AppError::InvalidInput(format!(
                "unknown album kind: {kind}"
            )));
        }
    }

    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_move_tracks",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "item_ids": spec.item_ids,
                "target_album_id": spec.target_album_id,
                "new_album": new_album,
                "kind": spec.kind,
                "renumber": spec.renumber,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    // Every moved file is now a dead path in any M3U line naming it.
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

/// Say whether these albums are releases or someone's own gatherings.
///
/// Takes a list of beets album ids because the front groups by (artist, title):
/// one card can stand for two album rows, and both have to move together.
#[tauri::command]
pub async fn set_album_kind(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_ids: Vec<i64>,
    kind: String,
) -> AppResult<Value> {
    if !ALBUM_KINDS.contains(&kind.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unknown album kind: {kind}"
        )));
    }
    if album_ids.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "album_kind_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_ids": album_ids,
                "kind": kind,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

/// The 13 browse families, by the display labels the sidecar's genre tree
/// produces — the same strings the front uses as family keys. The sidecar
/// validates them again; both sides say it so neither has to trust the other.
const FAMILY_LABELS: &[&str] = &[
    "Metal",
    "Rock",
    "Pop",
    "Electronic",
    "Hip-Hop",
    "R&B, Soul & Funk",
    "Jazz",
    "Blues",
    "Folk & Country",
    "Classical",
    "Reggae",
    "Latin",
    "World",
];

/// File a genre under a family of the user's choosing, or return it to the
/// base tree (family = None). The placement is an opinion about the genre
/// *name* — no track is touched; the read path rebuckets on its own.
#[tauri::command]
pub async fn set_genre_family(
    app: AppHandle,
    state: State<'_, SidecarState>,
    genre: String,
    family: Option<String>,
) -> AppResult<Value> {
    if genre.trim().is_empty() {
        return Err(AppError::InvalidInput("empty genre".into()));
    }
    if let Some(label) = family.as_deref() {
        if !FAMILY_LABELS.contains(&label) {
            return Err(AppError::InvalidInput(format!("unknown family: {label}")));
        }
    }
    state
        .request(
            &app,
            "genre_family_set",
            json!({ "genre": genre, "family": family }),
            QUERY_TIMEOUT,
        )
        .await
}

/// Every placement the user has made, for the front to mark overridden genres.
#[tauri::command]
pub async fn list_genre_overrides(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> AppResult<Value> {
    state
        .request(&app, "genre_overrides_list", json!({}), QUERY_TIMEOUT)
        .await
}

/// Checks a person may legitimately mean to leave as they are, per scope. The
/// sidecar validates the same pair; both sides say it so neither has to trust
/// the other. `suspect` and `tracklist` are deliberately absent — see
/// `accepted.py` for why.
const TRACK_CHECKS: &[&str] = &["year", "track", "genre", "duplicates"];
const ALBUM_CHECKS: &[&str] = &["artwork"];

/// Answer a check: "I have seen it, it is what I want" — or take that back.
#[tauri::command]
pub async fn set_check_accepted(
    app: AppHandle,
    state: State<'_, SidecarState>,
    scope: String,
    ids: Vec<i64>,
    check: String,
    accepted: bool,
) -> AppResult<Value> {
    let valid = match scope.as_str() {
        "track" => TRACK_CHECKS,
        "album" => ALBUM_CHECKS,
        other => return Err(AppError::InvalidInput(format!("unknown scope: {other}"))),
    };
    if !valid.contains(&check.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unknown {scope} check: {check}"
        )));
    }
    if ids.is_empty() {
        return Ok(json!({ "updated": 0 }));
    }

    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "accepted_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "scope": scope,
                "ids": ids,
                "check": check,
                "accepted": accepted,
            }),
            QUERY_TIMEOUT,
        )
        .await
}

#[tauri::command]
pub async fn delete_track(
    app: AppHandle,
    state: State<'_, SidecarState>,
    jobs: State<'_, JobsState>,
    id: i64,
) -> AppResult<Value> {
    let paths = AppPaths::resolve(&app)?;
    let result = state
        .request(
            &app,
            "library_remove",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "id": id,
            }),
            QUERY_TIMEOUT,
        )
        .await?;
    // No foreign key can span the two database files, so playlist memberships
    // are pruned here — best-effort, the delete itself already succeeded.
    if let Err(err) = jobs.remove_item_from_playlists(id).await {
        eprintln!("[playlists] prune of item {id} failed: {err}");
    }
    crate::playlists_mirror::sync(&app, &jobs).await;
    Ok(result)
}

/// Image formats a replacement cover may arrive in: what Pillow decodes, the
/// webview previews, and the pipeline can archive. Deliberately short — HEIC
/// and the like can join once each reader is proven, not before.
const COVER_SOURCE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

/// A user-picked image path, canonicalised and checked before anything trusts
/// it: it must exist, be a file, and wear a whitelisted extension.
pub(crate) async fn checked_cover_source(path: &str) -> AppResult<PathBuf> {
    let canonical = tokio::fs::canonicalize(path)
        .await
        .map_err(|_| AppError::InvalidInput(format!("file not found: {path}")))?;
    let extension = canonical
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !COVER_SOURCE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "unsupported image type: .{extension}"
        )));
    }
    let meta = tokio::fs::metadata(&canonical).await?;
    if !meta.is_file() {
        return Err(AppError::InvalidInput("not a file".into()));
    }
    Ok(canonical)
}

/// Let the webview preview a cover candidate that lives outside the library:
/// the asset scope only covers the library and app data, so a picked file is
/// admitted one path at a time. Returns its size for the modal's weight line.
#[tauri::command]
pub async fn allow_cover_preview(app: AppHandle, path: String) -> AppResult<Value> {
    use tauri::Manager;

    let canonical = checked_cover_source(&path).await?;
    let bytes = tokio::fs::metadata(&canonical).await?.len();
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|err| AppError::InvalidInput(format!("could not admit the file: {err}")))?;
    Ok(json!({ "path": canonical.to_string_lossy(), "bytes": bytes }))
}

/// The square the sidecar should cut from the source image, in source pixels
/// after EXIF orientation — the same frame the preview showed the user.
#[derive(Deserialize)]
pub struct CoverCrop {
    pub(crate) left: u32,
    pub(crate) top: u32,
    pub(crate) size: u32,
}

/// Replace an album's cover: archive the image as cover-hq.*, write the 500px
/// rendition as beets' artpath, embed it into the album's m4a files, and drop
/// the provisional-cover flag. The image is either a local file (with an
/// optional crop) or a Cover Art Archive upload picked from the candidates.
#[tauri::command]
pub async fn set_album_cover(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_id: i64,
    source_path: Option<String>,
    crop: Option<CoverCrop>,
    candidate_url: Option<String>,
) -> AppResult<Value> {
    if album_id <= 0 {
        return Err(AppError::InvalidInput(format!("bad album id: {album_id}")));
    }
    if source_path.is_some() == candidate_url.is_some() {
        return Err(AppError::InvalidInput(
            "exactly one of source_path / candidate_url is required".into(),
        ));
    }
    if let Some(CoverCrop { size, .. }) = crop {
        if size == 0 {
            return Err(AppError::InvalidInput("empty crop".into()));
        }
    }
    if let Some(url) = &candidate_url {
        // Only what our own candidates listing handed out: the sidecar will
        // fetch this URL, so nothing else may choose where it connects.
        if !url.starts_with("https://coverartarchive.org/") {
            return Err(AppError::InvalidInput(
                "candidate URL outside the Cover Art Archive".into(),
            ));
        }
    }
    let source = match source_path {
        Some(path) => Some(checked_cover_source(&path).await?),
        None => None,
    };
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "cover_set",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_id": album_id,
                "source_path": source.map(|p| p.to_string_lossy().into_owned()),
                "image_url": candidate_url,
                "crop": crop.map(|c| json!({ "left": c.left, "top": c.top, "size": c.size })),
            }),
            // Downloading a full-size CAA upload can outlast a query.
            Duration::from_secs(120),
        )
        .await
}

/// What the Cover Art Archive holds for this album — thumbnails inlined as
/// data URLs (the webview's CSP allows no remote images).
#[tauri::command]
pub async fn list_cover_candidates(
    app: AppHandle,
    state: State<'_, SidecarState>,
    album_id: i64,
) -> AppResult<Value> {
    if album_id <= 0 {
        return Err(AppError::InvalidInput(format!("bad album id: {album_id}")));
    }
    let paths = AppPaths::resolve(&app)?;
    state
        .request(
            &app,
            "cover_candidates",
            json!({
                "beets_db": paths.beets_db.to_string_lossy(),
                "library_dir": paths.music_dir().to_string_lossy(),
                "album_id": album_id,
            }),
            // The index plus up to eight thumbnail fetches.
            Duration::from_secs(90),
        )
        .await
}

/// The Appearance setting, pushed to the native frame. Thin on purpose: the
/// window is the state, so there is nothing to keep here.
#[tauri::command]
pub fn set_window_theme(window: tauri::WebviewWindow, choice: window_chrome::ThemeChoice) {
    window_chrome::follow(&window, choice);
}
