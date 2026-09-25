//! Native audio playback on rodio.
//!
//! The front decides what plays; this module owns a two-slot file queue
//! (playing + preloaded, for gapless) and pushes playback status.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio_formats;
use crate::error::{AppError, AppResult};
use crate::now_playing;

struct Engine {
    /// Held only to keep the output alive: dropping it silences everything.
    _device: MixerDeviceSink,
    player: Player,
}

/// rodio reports that its queue ran dry, never why. Remembering the loaded
/// file is what separates a track that finished from a decoder that gave up.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loaded {
    path: String,
    duration: Option<f64>,
}

#[derive(Debug, Default, Clone)]
struct Files {
    /// `None` after an explicit stop, so a stop never reads as a track ending.
    current: Option<Loaded>,
    next: Option<Loaded>,
}

/// The audio device is opened lazily on first play, so a machine without
/// audio output can still launch the app.
#[derive(Default)]
pub struct PlayerState {
    engine: Mutex<Option<Engine>>,
    files: Mutex<Files>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
    pub position: f64,
    pub duration: Option<f64>,
    pub is_playing: bool,
    /// Distinguishes "paused" from "finished"; both have `is_playing: false`.
    pub loaded: bool,
    /// Files queued behind the playing one.
    pub queued: usize,
}

/// Maps a 0…1 slider to amplitude with a square taper, since perceived
/// loudness is logarithmic.
pub fn amplitude_for(level: f32) -> f32 {
    let clamped = level.clamp(0.0, 1.0);
    clamped * clamped
}

/// Guards `player_load` against arbitrary paths coming over IPC.
///
/// `..` is rejected rather than resolved: `starts_with` compares components,
/// so `<library>/../../etc/passwd` would pass the prefix check.
pub fn ensure_in_library(path: &str, library: &Path) -> AppResult<()> {
    let path = Path::new(path);
    if path
        .components()
        .any(|part| matches!(part, std::path::Component::ParentDir))
    {
        return Err(AppError::InvalidInput(
            "a playable path may not walk up out of the library".into(),
        ));
    }
    if !path.starts_with(library) {
        return Err(AppError::InvalidInput(
            "that file is not in the Sonarche library".into(),
        ));
    }
    Ok(())
}

/// `Decoder::try_from` (not `new`) gives symphonia the file length, without
/// which every backwards seek fails with `ForwardOnly`.
fn decode(path: &str) -> AppResult<Decoder<BufReader<File>>> {
    if !Path::new(path).is_file() {
        return Err(AppError::InvalidInput(format!("no such file: {path}")));
    }
    if !audio_formats::is_playable(path) {
        return Err(AppError::UnsupportedFormat(path.to_string()));
    }
    let file = File::open(path)?;
    Decoder::try_from(file)
        .map_err(|err| AppError::Playback(format!("cannot decode {path}: {err}")))
}

impl PlayerState {
    fn with_engine<T>(&self, f: impl FnOnce(&Engine) -> T) -> AppResult<T> {
        // The guarded state holds no invariant a panic could break, so a
        // poisoned lock is recovered instead of disabling the player.
        let mut guard = self.engine.lock().unwrap_or_else(|err| err.into_inner());

        if guard.is_none() {
            let device = DeviceSinkBuilder::open_default_sink()
                .map_err(|err| AppError::Playback(format!("no audio output: {err}")))?;
            let player = Player::connect_new(device.mixer());
            *guard = Some(Engine {
                _device: device,
                player,
            });
        }

        let engine = guard
            .as_ref()
            .ok_or_else(|| AppError::Playback("audio engine unavailable".into()))?;
        Ok(f(engine))
    }

    /// Like `with_engine`, but never opens the device.
    fn peek<T: Default>(&self, f: impl FnOnce(&Engine) -> T) -> T {
        let guard = self.engine.lock().unwrap_or_else(|err| err.into_inner());
        guard.as_ref().map(f).unwrap_or_default()
    }

    fn with_files<T>(&self, f: impl FnOnce(&mut Files) -> T) -> T {
        f(&mut self.files.lock().unwrap_or_else(|err| err.into_inner()))
    }

    fn remembered(&self) -> Option<Loaded> {
        self.with_files(|files| files.current.clone())
    }

    /// Promotes the preloaded file after a gapless hand-over.
    pub fn advance(&self) -> Option<Loaded> {
        self.with_files(|files| {
            let next = files.next.take()?;
            files.current = Some(next.clone());
            Some(next)
        })
    }

    /// Plays `path` now, dropping the queue. Volume is kept.
    pub fn load(&self, path: &str) -> AppResult<Option<f64>> {
        let source = decode(path)?;
        let duration = source.total_duration().map(|d| d.as_secs_f64());
        self.with_engine(move |engine| {
            engine.player.clear();
            engine.player.append(source);
            // `clear` leaves the player paused.
            engine.player.play();
        })?;
        self.with_files(|files| {
            *files = Files {
                current: Some(Loaded {
                    path: path.to_owned(),
                    duration,
                }),
                next: None,
            }
        });
        Ok(duration)
    }

    /// Queues `path` behind the playing file for a gapless transition.
    pub fn enqueue(&self, path: &str) -> AppResult<()> {
        let source = decode(path)?;
        let duration = source.total_duration().map(|d| d.as_secs_f64());
        self.with_engine(move |engine| engine.player.append(source))?;
        self.with_files(|files| {
            files.next = Some(Loaded {
                path: path.to_owned(),
                duration,
            })
        });
        Ok(())
    }

    /// Returns whether it is playing afterwards.
    pub fn toggle(&self) -> AppResult<bool> {
        self.with_engine(|engine| {
            if engine.player.empty() {
                return false;
            }
            if engine.player.is_paused() {
                engine.player.play();
            } else {
                engine.player.pause();
            }
            !engine.player.is_paused()
        })
    }

    /// Blocks until the audio thread picks the seek up; call via `off_runtime`.
    pub fn seek(&self, seconds: f64) -> AppResult<()> {
        let target = Duration::from_secs_f64(seconds.max(0.0));
        self.with_engine(|engine| {
            // rodio would keep a seek on an empty player and apply it to the
            // next track, which would then start part-way in.
            if engine.player.empty() {
                return Ok(());
            }
            engine
                .player
                .try_seek(target)
                .map_err(|err| AppError::Playback(format!("seek failed: {err}")))
        })?
    }

    /// Reopens the current file at `position` after a seek broke the demuxer.
    pub fn recover(&self, position: f64) -> AppResult<()> {
        let Some(file) = self.remembered() else {
            return Ok(());
        };
        let source = decode(&file.path)?;
        self.with_engine(move |engine| {
            engine.player.clear();
            engine.player.append(source);
            engine.player.play();
        })?;
        // `clear` dropped the preloaded file; the front will preload again.
        self.with_files(|files| files.next = None);
        self.seek(position)
    }

    pub fn set_volume(&self, level: f32) -> AppResult<()> {
        self.with_engine(|engine| engine.player.set_volume(amplitude_for(level)))
    }

    /// Clears the queue but keeps the device open.
    pub fn stop(&self) -> AppResult<()> {
        self.with_files(|files| *files = Files::default());
        self.with_engine(|engine| engine.player.clear())
    }

    /// `None` when the front emptied the engine itself.
    pub fn silence_after(&self, last_position: f64) -> Option<Silence> {
        let file = self.remembered()?;
        Some(if stopped_short(last_position, file.duration) {
            Silence::Broke
        } else {
            Silence::Ended
        })
    }

    pub fn status(&self) -> PlaybackStatus {
        let duration = self.remembered().and_then(|file| file.duration);
        self.peek(|engine| {
            let loaded = !engine.player.empty();
            PlaybackStatus {
                position: engine.player.get_pos().as_secs_f64(),
                duration,
                is_playing: loaded && !engine.player.is_paused(),
                loaded,
                queued: engine.player.len().saturating_sub(1),
            }
        })
    }
}

/// Every `PlayerState` call waits on the audio thread, so it must not run on
/// the async runtime's threads.
pub async fn off_runtime<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(&PlayerState) -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(move || f(&app.state::<PlayerState>()))
        .await
        .map_err(|err| AppError::Playback(format!("playback thread failed: {err}")))?
}

const STATUS_INTERVAL: Duration = Duration::from_millis(250);

/// Emits only on change, so a paused player sends nothing over IPC.
pub fn worth_emitting(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    match previous {
        None => next.loaded,
        Some(last) => last != next,
    }
}

/// Detects the engine moving into the preloaded file on its own.
pub fn handed_over(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    next.loaded && previous.is_some_and(|last| last.queued > next.queued)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Silence {
    /// The track played out; the front advances its queue.
    Ended,
    /// The decoder gave up mid-track (typically after a seek); reopen it.
    Broke,
}

pub fn went_quiet(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    previous.is_some_and(|last| last.loaded) && !next.loaded
}

/// Slack for the last sampled position of a natural end, which always lands a
/// little early (250 ms sampling + device buffer).
const END_GRACE: f64 = 1.5;

/// Files without a declared duration count as ended, never as broken, so they
/// cannot loop forever.
pub fn stopped_short(last_position: f64, duration: Option<f64>) -> bool {
    duration.is_some_and(|total| last_position + END_GRACE < total)
}

/// Polls the engine for the app's lifetime (rodio has no callbacks) and feeds
/// both the front and the OS Now Playing panel.
pub fn spawn_status_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut previous: Option<PlaybackStatus> = None;
        loop {
            tokio::time::sleep(STATUS_INTERVAL).await;
            let status = app.state::<PlayerState>().status();

            if went_quiet(previous.as_ref(), &status) {
                let last_position = previous.as_ref().map_or(0.0, |last| last.position);
                match app.state::<PlayerState>().silence_after(last_position) {
                    Some(Silence::Broke) => {
                        let handle = app.clone();
                        let _ = tauri::async_runtime::spawn_blocking(move || {
                            handle.state::<PlayerState>().recover(last_position)
                        })
                        .await;
                    }
                    Some(Silence::Ended) => {
                        let _ = app.emit("player:ended", ());
                        now_playing::clear();
                    }
                    None => {}
                }
            } else if handed_over(previous.as_ref(), &status) {
                // Send the path, not a queue index: the front's queue may have
                // changed since it preloaded this file.
                if let Some(file) = app.state::<PlayerState>().advance() {
                    let _ = app.emit("player:advanced", &file);
                }
            }
            if worth_emitting(previous.as_ref(), &status) {
                let _ = app.emit("player:status", &status);
                if status.loaded {
                    now_playing::set_playback(status.is_playing, status.position);
                }
            }
            previous = Some(status);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_a_file_the_library_actually_holds() {
        let library = Path::new("/music/Sonarche");

        assert!(ensure_in_library(
            "/music/Sonarche/Air/Moon Safari/01 La femme d'argent.m4a",
            library
        )
        .is_ok());
    }

    #[test]
    fn refuses_a_file_outside_the_library() {
        let library = Path::new("/music/Sonarche");

        assert!(ensure_in_library("/etc/passwd", library).is_err());
        assert!(ensure_in_library("relative.m4a", library).is_err());
        // Same string prefix, different folder — the check is on components.
        assert!(ensure_in_library("/music/Sonarche-old/track.m4a", library).is_err());
    }

    /// The one that a plain prefix test lets through: every component matches
    /// the library until the `..` walks back out of it.
    #[test]
    fn refuses_a_path_that_climbs_out_of_the_library() {
        let library = Path::new("/music/Sonarche");

        assert!(ensure_in_library("/music/Sonarche/../../etc/passwd", library).is_err());
    }

    #[test]
    fn volume_taper_keeps_the_ends_honest() {
        // Silence and full scale must land exactly, whatever the curve between.
        assert_eq!(amplitude_for(0.0), 0.0);
        assert_eq!(amplitude_for(1.0), 1.0);
    }

    #[test]
    fn half_travel_is_about_half_as_loud() {
        // A quarter of the amplitude, ~-12 dB: the point of the taper. Passing
        // the slider through linearly would put this at 0.5 and make the top of
        // the travel feel dead.
        assert!((amplitude_for(0.5) - 0.25).abs() < f32::EPSILON);
    }

    #[test]
    fn volume_taper_is_monotonic() {
        let mut previous = -1.0;
        for step in 0..=20 {
            let value = amplitude_for(step as f32 / 20.0);
            assert!(value > previous, "level {step}/20 did not rise");
            previous = value;
        }
    }

    #[test]
    fn out_of_range_levels_are_clamped_rather_than_amplified() {
        // A slider that overshoots must not blow past unity gain, and a
        // negative must not come back positive through the squaring.
        assert_eq!(amplitude_for(1.5), 1.0);
        assert_eq!(amplitude_for(-0.5), 0.0);
    }

    #[test]
    fn a_missing_file_is_rejected_before_the_device_is_touched() {
        let Err(err) = decode("/nowhere/at/all.m4a") else {
            panic!("a missing file should be refused");
        };

        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
    }

    /// Missing is checked before format: a path that is both must read as
    /// missing, otherwise a typo in an Opus filename is reported as a codec
    /// problem.
    #[test]
    fn an_undecodable_file_is_named_as_such_and_not_as_a_playback_failure() {
        let file = std::env::temp_dir().join("sonarche-format-test.opus");
        std::fs::write(&file, b"not really an opus stream").expect("temp file");

        let outcome = decode(&file.to_string_lossy());
        std::fs::remove_file(&file).ok();

        let Err(err) = outcome else {
            panic!("an opus file should be refused");
        };
        assert!(matches!(err, AppError::UnsupportedFormat(_)), "got {err:?}");
    }

    /// Proves the widened `rodio` features are actually compiled in, not just
    /// spelled correctly in `Cargo.toml`: this exact file failed to decode
    /// before the engine knew anything but MP4. WAV because it is the one
    /// format that can be written by hand — a header and the samples.
    #[test]
    fn decodes_a_format_the_engine_could_not_open_before() {
        const SAMPLES: u32 = 100;
        let bytes: u32 = SAMPLES * 2;
        let mut wav = Vec::new();
        wav.extend(b"RIFF");
        wav.extend((36 + bytes).to_le_bytes());
        wav.extend(b"WAVEfmt ");
        wav.extend(16u32.to_le_bytes()); // chunk size
        wav.extend(1u16.to_le_bytes()); // PCM
        wav.extend(1u16.to_le_bytes()); // mono
        wav.extend(44100u32.to_le_bytes()); // sample rate
        wav.extend(88200u32.to_le_bytes()); // bytes per second
        wav.extend(2u16.to_le_bytes()); // block align
        wav.extend(16u16.to_le_bytes()); // bits per sample
        wav.extend(b"data");
        wav.extend(bytes.to_le_bytes());
        wav.extend(std::iter::repeat_n(0u8, bytes as usize));

        let file = std::env::temp_dir().join("sonarche-decode-test.wav");
        std::fs::write(&file, &wav).expect("temp file");

        let outcome = decode(&file.to_string_lossy());
        std::fs::remove_file(&file).ok();

        assert!(outcome.is_ok(), "wav should decode: {:?}", outcome.err());
    }

    #[test]
    fn status_on_an_unopened_engine_is_silent_rather_than_an_error() {
        // The front polls this before anything has played; it must not be what
        // seizes the audio device.
        let state = PlayerState::default();

        assert_eq!(
            state.status(),
            PlaybackStatus {
                position: 0.0,
                duration: None,
                is_playing: false,
                loaded: false,
                queued: 0,
            }
        );
    }

    fn status(loaded: bool, is_playing: bool, position: f64) -> PlaybackStatus {
        PlaybackStatus {
            position,
            duration: None,
            is_playing,
            loaded,
            queued: 0,
        }
    }

    #[test]
    fn an_idle_player_says_nothing_on_the_wire() {
        // The loop ticks four times a second for the app's whole life; a paused
        // or empty player must not turn that into four IPC messages a second.
        let idle = status(false, false, 0.0);

        assert!(!worth_emitting(None, &idle));
        assert!(!worth_emitting(Some(&idle), &idle));
    }

    #[test]
    fn a_moving_playhead_is_emitted() {
        let before = status(true, true, 1.0);
        let after = status(true, true, 1.25);

        assert!(worth_emitting(Some(&before), &after));
    }

    #[test]
    fn running_out_of_audio_is_a_silence() {
        let playing = status(true, true, 218.4);
        let empty = status(false, false, 0.0);

        assert!(went_quiet(Some(&playing), &empty));
    }

    #[test]
    fn pausing_is_not_a_silence() {
        // The distinction the `loaded` flag exists for: both report
        // `is_playing: false`, and treating a pause as an end would skip to the
        // next track every time the user pressed pause.
        let playing = status(true, true, 12.0);
        let paused = status(true, false, 12.0);

        assert!(!went_quiet(Some(&playing), &paused));
    }

    #[test]
    fn a_player_that_never_started_never_went_quiet() {
        let empty = status(false, false, 0.0);

        assert!(!went_quiet(None, &empty));
        assert!(!went_quiet(Some(&empty), &empty));
    }

    #[test]
    fn a_track_that_stops_mid_way_broke_rather_than_ended() {
        // The seek-bar bug: a seek leaves the demuxer unable to hand over the
        // next packet, the source ends 30 s into a 218 s track, and the front
        // — told the track was over — plays the next one.
        assert!(stopped_short(30.0, Some(218.4)));
    }

    #[test]
    fn a_track_that_runs_out_near_its_length_ended() {
        // Sampled four times a second with audio buffered ahead of the
        // playhead, the last position seen before a natural end is always a
        // little short. Calling that broken would replay the last second of
        // every track, forever.
        assert!(!stopped_short(218.0, Some(218.4)));
        assert!(!stopped_short(217.3, Some(218.4)));
    }

    #[test]
    fn a_file_without_a_declared_length_is_given_the_benefit_of_the_doubt() {
        // Nothing to compare against: unprovable is not the same as broken, and
        // guessing "broken" would put the file back on repeat.
        assert!(!stopped_short(4.0, None));
    }

    fn queued_status(loaded: bool, queued: usize) -> PlaybackStatus {
        PlaybackStatus {
            queued,
            ..status(loaded, true, 0.0)
        }
    }

    #[test]
    fn losing_a_queued_file_while_still_playing_is_a_hand_over() {
        // Nothing else in the status says it happened: playback does not stop,
        // the playhead just starts over inside a different file.
        assert!(handed_over(
            Some(&queued_status(true, 1)),
            &queued_status(true, 0)
        ));
    }

    #[test]
    fn running_out_with_nothing_queued_is_not_a_hand_over() {
        // Same drop in `queued`, but the engine went silent: that is the end of
        // the track, and the two must not both fire.
        assert!(!handed_over(
            Some(&queued_status(true, 0)),
            &queued_status(false, 0)
        ));
    }

    #[test]
    fn queueing_a_file_is_not_a_hand_over() {
        assert!(!handed_over(
            Some(&queued_status(true, 0)),
            &queued_status(true, 1)
        ));
    }

    #[test]
    fn a_silence_with_nothing_remembered_is_the_front_stopping_playback() {
        // `stop` forgets the file precisely so this is not reported as an end —
        // the OS stop button would otherwise start the next track.
        let state = PlayerState::default();

        assert_eq!(state.silence_after(12.0), None);
    }
}
