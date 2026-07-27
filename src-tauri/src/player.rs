//! Native audio playback.
//!
//! The webview's `<audio>` element read every track through Tauri's asset
//! protocol, which reports roughly twice a track's real duration — measured at
//! 436.95s for a file the header, `afinfo` and a plain HTTP fetch all agree is
//! 218.45s. The front compensated by cutting playback off at the library's own
//! length. Decoding here reads the file off disk, so the distortion has no way
//! in, and the engine can hold more than one track at a time — which is what
//! gapless needs and an `<audio>` element cannot do.
//!
//! The front stays in charge of *what* plays: this module owns one queue of
//! files and reports what it is doing. It knows nothing about tracks, albums or
//! shuffle.

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

/// The output device and the queue feeding it.
///
/// `_device` is held only to keep it alive: dropping it silences everything
/// downstream, however healthy the player looks.
struct Engine {
    _device: MixerDeviceSink,
    player: Player,
}

/// The file the engine was handed, and what we know about it.
///
/// Kept because rodio only reports that it has run out of audio, never why. A
/// track that played out and one whose decoder gave up mid-seek look identical
/// from the outside, and answering the second by advancing the queue is the
/// "clicking the seek bar jumps to another song" bug.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loaded {
    path: String,
    /// Decoded length, when the file declares one.
    duration: Option<f64>,
}

/// The two files the engine holds: the one playing, and the one lined up behind
/// it. Mirrors rodio's own queue, which reports how many sources are left but
/// never which.
#[derive(Debug, Default, Clone)]
struct Files {
    /// Empty when the front stopped playback on purpose, which is how a stop is
    /// told apart from a track running out.
    current: Option<Loaded>,
    next: Option<Loaded>,
}

/// Opened on first play rather than at startup: an app the user only ever
/// downloads with should not seize the audio device, and on a machine with no
/// output at all, failing here would be failing to launch.
#[derive(Default)]
pub struct PlayerState {
    engine: Mutex<Option<Engine>>,
    files: Mutex<Files>,
}

/// What the engine is doing, as the front needs to draw it.
///
/// `Default` is the silent state, which is also the honest answer before the
/// audio device has ever been opened.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
    /// Playhead in seconds.
    pub position: f64,
    /// Decoded length of the playing file, or null when nothing is loaded.
    pub duration: Option<f64>,
    pub is_playing: bool,
    /// Whether anything is loaded at all. Paused and finished both report
    /// `is_playing: false`, and only this tells them apart — which is how the
    /// status loop knows a track ended rather than was paused.
    pub loaded: bool,
    /// Files still queued behind the playing one — 0 means it is the last.
    pub queued: usize,
}

/// Amplitude for a 0…1 slider position.
///
/// Loudness is perceived logarithmically while `set_volume` takes a linear
/// amplitude, so passing the slider through unchanged makes the top half of its
/// travel do almost nothing and the bottom half do everything. Squaring is the
/// usual audio taper: half travel lands at a quarter amplitude, about -12 dB,
/// which reads as "half as loud".
pub fn amplitude_for(level: f32) -> f32 {
    let clamped = level.clamp(0.0, 1.0);
    clamped * clamped
}

/// Open a file for playback.
///
/// `Decoder::try_from` rather than `Decoder::new`, and the difference is the
/// whole of backwards seeking: `new` hands symphonia a stream of unknown length,
/// and a demuxer that does not know where the file ends can only ever go
/// forwards — every backwards seek came back `ForwardOnly` and silently did
/// nothing. `try_from` reads the length from the file's own metadata.
/// The extension is checked before the file is opened so an imported track we
/// cannot decode says so in its own terms — symphonia's answer to an Opus
/// stream is "unsupported feature", which tells the user nothing.
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
    /// Runs `f` against a live engine, opening the device if this is the first
    /// sound the app makes.
    fn with_engine<T>(&self, f: impl FnOnce(&Engine) -> T) -> AppResult<T> {
        // A panic anywhere under this lock used to leave the player refusing
        // every call for the rest of the session. Nothing here holds an
        // invariant a panic could break — it is a device handle and a queue —
        // so the honest answer to poisoning is to carry on.
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

    /// Reads the engine only if it exists. Status polling must not be what
    /// opens the audio device.
    fn peek<T: Default>(&self, f: impl FnOnce(&Engine) -> T) -> T {
        let guard = self.engine.lock().unwrap_or_else(|err| err.into_inner());
        guard.as_ref().map(f).unwrap_or_default()
    }

    fn with_files<T>(&self, f: impl FnOnce(&mut Files) -> T) -> T {
        f(&mut self.files.lock().unwrap_or_else(|err| err.into_inner()))
    }

    /// The file the engine is on, if the front has not emptied it.
    fn remembered(&self) -> Option<Loaded> {
        self.with_files(|files| files.current.clone())
    }

    /// The queued file has become the playing one — the engine crossed over on
    /// its own. Returns it so the front can be told what it is now hearing.
    pub fn advance(&self) -> Option<Loaded> {
        self.with_files(|files| {
            // Nothing was lined up, so the queue shrank for another reason: a
            // load dropping a preloaded track along with everything else. The
            // playing file stands, and forgetting it here would leave the next
            // real end unreportable.
            let next = files.next.take()?;
            files.current = Some(next.clone());
            Some(next)
        })
    }

    /// Play `path` now, dropping whatever was queued. The volume in force
    /// survives — it belongs to the session, not to the track.
    pub fn load(&self, path: &str) -> AppResult<Option<f64>> {
        let source = decode(path)?;
        let duration = source.total_duration().map(|d| d.as_secs_f64());
        self.with_engine(move |engine| {
            engine.player.clear();
            engine.player.append(source);
            // `clear` leaves the player paused; nothing plays without this.
            engine.player.play();
        })?;
        // `load` drops the queue, so whatever was lined up behind is gone too.
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

    /// Queue `path` behind what is playing. This is the gapless path: the
    /// engine crosses into the next file itself, with no gap to open a decoder,
    /// which is exactly what reassigning `<audio>.src` could never avoid.
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

    /// Toggle play/pause. Returns whether it is playing afterwards; false when
    /// nothing is loaded, since a toggle cannot start what was never given.
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

    pub fn pause(&self) -> AppResult<()> {
        self.with_engine(|engine| engine.player.pause())
    }

    /// Move the playhead. Blocks for a few milliseconds while the audio thread
    /// picks the order up — which is why every caller comes through
    /// `off_runtime`, and why the front sends one of these per gesture rather
    /// than one per pointer move.
    pub fn seek(&self, seconds: f64) -> AppResult<()> {
        let target = Duration::from_secs_f64(seconds.max(0.0));
        self.with_engine(|engine| {
            // Seeking an empty player is not a no-op: rodio keeps the order in
            // its controls, and the *next* track picks it up and starts part of
            // the way in. The front does seek an empty engine — `previous` at
            // the top of a track, a finished queue — so this guard earns itself.
            if engine.player.empty() {
                return Ok(());
            }
            engine
                .player
                .try_seek(target)
                .map_err(|err| AppError::Playback(format!("seek failed: {err}")))
        })?
    }

    /// Reopen the file the engine was on and carry on from `position`.
    ///
    /// A seek can leave the demuxer unable to hand over the next packet, and
    /// the source then simply ends. Reopening is the difference between a
    /// hiccup and the player either falling silent or skipping a track.
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
        // Clearing took the lined-up track with it; the front preloads again.
        self.with_files(|files| files.next = None);
        self.seek(position)
    }

    /// `level` is the slider position, 0…1 — see `amplitude_for`.
    pub fn set_volume(&self, level: f32) -> AppResult<()> {
        self.with_engine(|engine| engine.player.set_volume(amplitude_for(level)))
    }

    /// Stop and empty the queue, keeping the device open for the next play.
    /// Forgetting the file is what tells the status loop this silence was
    /// asked for rather than the track running out.
    pub fn stop(&self) -> AppResult<()> {
        self.with_files(|files| *files = Files::default());
        self.with_engine(|engine| engine.player.clear())
    }

    /// What a silence means, once the engine has gone quiet at `last_position`.
    /// `None` when nothing is remembered — the front emptied the engine itself.
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

/// Run a blocking engine call off the async runtime.
///
/// Every call on `PlayerState` waits on the audio thread — `clear` until the
/// queue has flushed, `try_seek` until the order is picked up — and a Tauri
/// command runs on the runtime's own threads. Running them inline is how a
/// flurry of seeks used to take the rest of the app down with it.
pub async fn off_runtime<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(&PlayerState) -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(move || f(&app.state::<PlayerState>()))
        .await
        .map_err(|err| AppError::Playback(format!("playback thread failed: {err}")))?
}

/// How often the playhead is pushed to the front. Four times a second is what
/// `timeupdate` gave the old `<audio>` path, and a seek bar needs no more.
const STATUS_INTERVAL: Duration = Duration::from_millis(250);

/// Whether this status is worth an IPC message.
///
/// A paused or idle player produces an identical status forever, and waking the
/// front four times a second to redraw an unchanged seek bar is exactly the
/// churn the player's context split exists to avoid. Emitting only on change
/// means a paused app is completely silent on the wire.
pub fn worth_emitting(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    match previous {
        None => next.loaded,
        Some(last) => last != next,
    }
}

/// Whether the engine has just crossed from the playing file into the one
/// queued behind it — the gapless hand-over, which it performs on its own.
///
/// The front owns the queue and draws the track, so it has to be told; nothing
/// else about the status says it happened, because playback never stops.
pub fn handed_over(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    next.loaded && previous.is_some_and(|last| last.queued > next.queued)
}

/// Why the engine fell silent. Rodio only reports that it has run out of
/// audio, never why, and the two cases call for opposite answers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Silence {
    /// The track played out. The front's queue decides what follows.
    Ended,
    /// It stopped well short of its own length — a seek left the demuxer unable
    /// to hand over the next packet and the source ended there. Reported as an
    /// end, the front would answer by skipping to the next track.
    Broke,
}

/// Whether the engine just ran out of audio. A pause keeps `loaded` true, so
/// this really is "it had something to play and no longer does".
pub fn went_quiet(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    previous.is_some_and(|last| last.loaded) && !next.loaded
}

/// How far short of its own length a track may stop and still count as having
/// played out. The loop samples four times a second and the device holds a
/// little audio beyond the playhead, so the last position seen before a natural
/// end is always slightly early.
const END_GRACE: f64 = 1.5;

/// Whether a track that has gone quiet stopped well short of its length.
///
/// This is the whole difference between "the track is over, advance the queue"
/// and "the decoder gave up, put it back". Files that declare no duration get
/// the benefit of the doubt: unprovable is not the same as broken, and treating
/// them as broken would loop them forever.
pub fn stopped_short(last_position: f64, duration: Option<f64>) -> bool {
    duration.is_some_and(|total| last_position + END_GRACE < total)
}

/// Push the playhead to the front for the app's lifetime.
///
/// A poll rather than a callback because rodio reports state rather than
/// announcing it, and because the same tick has to serve both purposes: moving
/// the seek bar, and noticing that a track ran out so the front can queue the
/// next one.
/// This one tick serves both audiences — the front's seek bar and the OS's
/// Now Playing panel. They need the same two facts at the same moment, and a
/// second loop for the OS would only be this one, offset by a few milliseconds.
pub fn spawn_status_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut previous: Option<PlaybackStatus> = None;
        loop {
            tokio::time::sleep(STATUS_INTERVAL).await;
            let status = app.state::<PlayerState>().status();

            if went_quiet(previous.as_ref(), &status) {
                let last_position = previous.as_ref().map_or(0.0, |last| last.position);
                match app.state::<PlayerState>().silence_after(last_position) {
                    // The decoder gave up rather than reaching the end. Told to
                    // the front, this would read as "next track, please".
                    Some(Silence::Broke) => {
                        let handle = app.clone();
                        let _ = tauri::async_runtime::spawn_blocking(move || {
                            handle.state::<PlayerState>().recover(last_position)
                        })
                        .await;
                    }
                    Some(Silence::Ended) => {
                        let _ = app.emit("player:ended", ());
                        // Clear the OS panel rather than leaving a finished
                        // track sitting there looking merely paused.
                        now_playing::clear();
                    }
                    // The front emptied the engine itself: a stop is its own
                    // doing and needs no answer.
                    None => {}
                }
            } else if handed_over(previous.as_ref(), &status) {
                // The engine crossed into the queued file by itself. The front
                // is told what it is now hearing rather than which slot moved:
                // its queue may have changed since it lined this one up, and
                // the path is what settles it.
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
