//! What the OS shows and controls: media keys, Control Center, the lock
//! screen, the menu-bar Now Playing panel.
//!
//! The webview used to give us this for free through `navigator.mediaSession`,
//! but only as a side effect of playing an `<audio>` element — the browser
//! exposes a session for a page that is itself playing media, and once playback
//! moved into `player`, there was no such page. This talks to the OS directly
//! instead, through souvlaki's public-API bindings (`MPNowPlayingInfoCenter`
//! and `MPRemoteCommandCenter` on macOS, MPRIS and SMTC elsewhere).
//!
//! It deliberately holds no playback state. `player` owns the engine, the front
//! owns the queue, and this only mirrors outwards and forwards presses back —
//! a remote press becomes a `player:remote` event and takes the same path a
//! click on the transport would.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
};
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

/// What the OS is being told about the track. Owned by the front, which is the
/// only side that knows a track is more than a file path.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlayingTrack {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    /// Absolute path to the cover image. Turned into a `file://` URL here, so
    /// the front never has to know what shape each platform wants.
    pub art_path: Option<String>,
    pub duration: Option<f64>,
}

/// A press on a system control, on its way to the front.
///
/// Only the commands the app actually implements: an OS button the queue has
/// no answer for is better left unregistered than registered and inert.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RemoteAction {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    /// Absolute position in seconds, from the lock screen's scrubber.
    Seek(f64),
}

/// Which of our actions an OS event maps to, if any.
///
/// Split out from the handler so the mapping is testable without an OS session:
/// a wrong arm here means a media key that silently does the wrong thing, which
/// is exactly the kind of bug nobody notices until it is annoying.
pub fn action_for(event: MediaControlEvent) -> Option<RemoteAction> {
    match event {
        MediaControlEvent::Play => Some(RemoteAction::Play),
        MediaControlEvent::Pause => Some(RemoteAction::Pause),
        MediaControlEvent::Toggle => Some(RemoteAction::Toggle),
        MediaControlEvent::Next => Some(RemoteAction::Next),
        MediaControlEvent::Previous => Some(RemoteAction::Previous),
        MediaControlEvent::Stop | MediaControlEvent::Quit => Some(RemoteAction::Stop),
        MediaControlEvent::SetPosition(MediaPosition(position)) => {
            Some(RemoteAction::Seek(position.as_secs_f64()))
        }
        // Relative seeks and the open-URI request have no counterpart here; the
        // front's transport is absolute.
        _ => None,
    }
}

#[derive(Default)]
pub struct NowPlayingState {
    controls: Mutex<Option<MediaControls>>,
}

impl NowPlayingState {
    fn with_controls<T>(
        &self,
        app: &AppHandle,
        f: impl FnOnce(&mut MediaControls) -> T,
    ) -> AppResult<T> {
        let mut guard = self
            .controls
            .lock()
            .map_err(|_| AppError::Playback("now-playing state is poisoned".into()))?;

        if guard.is_none() {
            let mut controls = MediaControls::new(PlatformConfig {
                dbus_name: "sonarche",
                display_name: "Sonarche",
                // macOS takes the session app-wide; only Windows needs a window
                // handle here, and this field does not exist on that platform's
                // config under another name — it is the Windows `hwnd`.
                hwnd: None,
            })
            .map_err(|err| AppError::Playback(format!("no media session: {err:?}")))?;

            let handle = app.clone();
            controls
                .attach(move |event| {
                    if let Some(action) = action_for(event) {
                        let _ = handle.emit("player:remote", action);
                    }
                })
                .map_err(|err| AppError::Playback(format!("cannot attach media keys: {err:?}")))?;
            *guard = Some(controls);
        }

        let controls = guard
            .as_mut()
            .ok_or_else(|| AppError::Playback("media session unavailable".into()))?;
        Ok(f(controls))
    }

    /// Describe the track the OS should show.
    pub fn set_track(&self, app: &AppHandle, track: &NowPlayingTrack) -> AppResult<()> {
        let cover = track.art_path.as_ref().map(|path| format!("file://{path}"));
        self.with_controls(app, |controls| {
            let _ = controls.set_metadata(MediaMetadata {
                title: track.title.as_deref(),
                artist: track.artist.as_deref(),
                album: track.album.as_deref(),
                cover_url: cover.as_deref(),
                duration: track.duration.map(Duration::from_secs_f64),
            });
        })
    }

    /// Mirror the transport. `position` keeps the lock screen's scrubber honest.
    pub fn set_playback(&self, app: &AppHandle, is_playing: bool, position: f64) -> AppResult<()> {
        let progress = Some(MediaPosition(Duration::from_secs_f64(position.max(0.0))));
        let state = if is_playing {
            MediaPlayback::Playing { progress }
        } else {
            MediaPlayback::Paused { progress }
        };
        self.with_controls(app, |controls| {
            let _ = controls.set_playback(state);
        })
    }

    /// Nothing is loaded any more — clear the OS panel rather than leaving a
    /// finished track sitting there as though it were paused.
    pub fn clear(&self, app: &AppHandle) -> AppResult<()> {
        self.with_controls(app, |controls| {
            let _ = controls.set_playback(MediaPlayback::Stopped);
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transport_events_map_to_their_action() {
        assert_eq!(
            action_for(MediaControlEvent::Play),
            Some(RemoteAction::Play)
        );
        assert_eq!(
            action_for(MediaControlEvent::Pause),
            Some(RemoteAction::Pause)
        );
        assert_eq!(
            action_for(MediaControlEvent::Toggle),
            Some(RemoteAction::Toggle)
        );
        assert_eq!(
            action_for(MediaControlEvent::Next),
            Some(RemoteAction::Next)
        );
        assert_eq!(
            action_for(MediaControlEvent::Previous),
            Some(RemoteAction::Previous)
        );
    }

    #[test]
    fn quitting_from_the_os_stops_rather_than_pauses() {
        // Both mean "the user is done", and leaving the engine paused would
        // keep the app holding the audio device for a session nobody wants.
        assert_eq!(
            action_for(MediaControlEvent::Stop),
            Some(RemoteAction::Stop)
        );
        assert_eq!(
            action_for(MediaControlEvent::Quit),
            Some(RemoteAction::Stop)
        );
    }

    #[test]
    fn the_lock_screen_scrubber_seeks_in_seconds() {
        let event = MediaControlEvent::SetPosition(MediaPosition(Duration::from_millis(90_500)));

        assert_eq!(action_for(event), Some(RemoteAction::Seek(90.5)));
    }

    #[test]
    fn unsupported_commands_are_dropped_rather_than_guessed() {
        // Registering a control we answer wrongly is worse than not answering:
        // the OS shows the button either way.
        assert_eq!(action_for(MediaControlEvent::OpenUri(String::new())), None);
        assert_eq!(
            action_for(MediaControlEvent::Seek(souvlaki::SeekDirection::Forward)),
            None
        );
    }
}
