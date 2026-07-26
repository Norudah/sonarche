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

use crate::error::{AppError, AppResult};
use crate::now_playing::NowPlayingState;

/// The output device and the queue feeding it.
///
/// `_device` is held only to keep it alive: dropping it silences everything
/// downstream, however healthy the player looks.
struct Engine {
    _device: MixerDeviceSink,
    player: Player,
}

/// Opened on first play rather than at startup: an app the user only ever
/// downloads with should not seize the audio device, and on a machine with no
/// output at all, failing here would be failing to launch.
#[derive(Default)]
pub struct PlayerState {
    engine: Mutex<Option<Engine>>,
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

fn decode(path: &str) -> AppResult<Decoder<BufReader<File>>> {
    if !Path::new(path).is_file() {
        return Err(AppError::InvalidInput(format!("no such file: {path}")));
    }
    let file = File::open(path)?;
    Decoder::new(BufReader::new(file))
        .map_err(|err| AppError::Playback(format!("cannot decode {path}: {err}")))
}

impl PlayerState {
    /// Runs `f` against a live engine, opening the device if this is the first
    /// sound the app makes.
    fn with_engine<T>(&self, f: impl FnOnce(&Engine) -> T) -> AppResult<T> {
        let mut guard = self
            .engine
            .lock()
            .map_err(|_| AppError::Playback("audio engine is poisoned".into()))?;

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
        match self.engine.lock() {
            Ok(guard) => guard.as_ref().map(f).unwrap_or_default(),
            Err(_) => T::default(),
        }
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
        Ok(duration)
    }

    /// Queue `path` behind what is playing. This is the gapless path: the
    /// engine crosses into the next file itself, with no gap to open a decoder,
    /// which is exactly what reassigning `<audio>.src` could never avoid.
    pub fn enqueue(&self, path: &str) -> AppResult<()> {
        let source = decode(path)?;
        self.with_engine(move |engine| engine.player.append(source))
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

    pub fn seek(&self, seconds: f64) -> AppResult<()> {
        let target = Duration::from_secs_f64(seconds.max(0.0));
        self.with_engine(|engine| {
            engine
                .player
                .try_seek(target)
                .map_err(|err| AppError::Playback(format!("seek failed: {err}")))
        })?
    }

    /// `level` is the slider position, 0…1 — see `amplitude_for`.
    pub fn set_volume(&self, level: f32) -> AppResult<()> {
        self.with_engine(|engine| engine.player.set_volume(amplitude_for(level)))
    }

    /// Stop and empty the queue, keeping the device open for the next play.
    pub fn stop(&self) -> AppResult<()> {
        self.with_engine(|engine| engine.player.clear())
    }

    pub fn status(&self) -> PlaybackStatus {
        self.peek(|engine| {
            let loaded = !engine.player.empty();
            PlaybackStatus {
                position: engine.player.get_pos().as_secs_f64(),
                duration: None,
                is_playing: loaded && !engine.player.is_paused(),
                loaded,
                queued: engine.player.len().saturating_sub(1),
            }
        })
    }
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

/// Whether the engine just ran out of audio on its own.
///
/// The front owns the queue, so it has to be told to advance. "Was loaded, is
/// no longer" is the whole test: a pause keeps `loaded` true, and a deliberate
/// stop is the front's own doing.
pub fn track_ended(previous: Option<&PlaybackStatus>, next: &PlaybackStatus) -> bool {
    previous.is_some_and(|last| last.loaded) && !next.loaded
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

            if track_ended(previous.as_ref(), &status) {
                let _ = app.emit("player:ended", ());
                // Clear the OS panel rather than leaving a finished track
                // sitting there looking merely paused.
                let _ = app.state::<NowPlayingState>().clear(&app);
            }
            if worth_emitting(previous.as_ref(), &status) {
                let _ = app.emit("player:status", &status);
                if status.loaded {
                    let _ = app.state::<NowPlayingState>().set_playback(
                        &app,
                        status.is_playing,
                        status.position,
                    );
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
    fn running_out_of_audio_ends_the_track() {
        let playing = status(true, true, 218.4);
        let empty = status(false, false, 0.0);

        assert!(track_ended(Some(&playing), &empty));
    }

    #[test]
    fn pausing_does_not_end_the_track() {
        // The distinction the `loaded` flag exists for: both report
        // `is_playing: false`, and treating a pause as an end would skip to the
        // next track every time the user pressed pause.
        let playing = status(true, true, 12.0);
        let paused = status(true, false, 12.0);

        assert!(!track_ended(Some(&playing), &paused));
    }

    #[test]
    fn a_player_that_never_started_never_ended() {
        let empty = status(false, false, 0.0);

        assert!(!track_ended(None, &empty));
        assert!(!track_ended(Some(&empty), &empty));
    }
}
