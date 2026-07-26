//! What the OS shows and controls: media keys, Control Center, the lock
//! screen, the menu-bar Now Playing panel.
//!
//! The webview used to give us this for free through `navigator.mediaSession`,
//! but only as a side effect of playing an `<audio>` element — the browser
//! exposes a session for a page that is itself playing media, and once playback
//! moved into `player`, there was no such page.
//!
//! This module holds no playback state. `player` owns the engine, the front
//! owns the queue, and this only mirrors outwards and forwards presses back —
//! a remote press becomes a `player:remote` event and takes the same path a
//! click on the transport would. Everything platform-specific lives one level
//! down; on a platform we have no session for, these are no-ops rather than
//! errors, because a missing media key is not a reason to fail a play.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
mod macos;

/// What the OS is being told about the track. Owned by the front, which is the
/// only side that knows a track is more than a file path.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlayingTrack {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    /// Absolute path to the cover image on disk. The platform layer turns it
    /// into whatever that OS wants.
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

/// Describe the track the OS should show. Also the moment the app claims the
/// media session: the transport commands are registered on the first track
/// rather than at launch, so an app nobody has played anything in does not take
/// the media keys away from whatever is playing.
pub fn set_track(app: &AppHandle, track: &NowPlayingTrack) {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        macos::attach_commands(move |action| {
            let _ = handle.emit("player:remote", action);
        });
        macos::set_track(track);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, track);
    }
}

/// Mirror the transport. `position` keeps the lock screen's scrubber honest.
pub fn set_playback(is_playing: bool, position: f64) {
    #[cfg(target_os = "macos")]
    macos::set_playback(is_playing, position);
    #[cfg(not(target_os = "macos"))]
    let _ = (is_playing, position);
}

/// Nothing is loaded any more — clear the OS panel rather than leaving a
/// finished track sitting there as though it were paused.
pub fn clear() {
    #[cfg(target_os = "macos")]
    macos::clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_remote_press_reaches_the_front_in_the_shape_it_reads() {
        // This enum is a wire contract: the front switches on these exact
        // strings, and `Seek` is the one it destructures for a value. Renaming
        // a variant here silently turns a media key into a no-op there.
        let json = |action: RemoteAction| serde_json::to_string(&action).unwrap();

        assert_eq!(json(RemoteAction::Toggle), r#""toggle""#);
        assert_eq!(json(RemoteAction::Next), r#""next""#);
        assert_eq!(json(RemoteAction::Previous), r#""previous""#);
        assert_eq!(json(RemoteAction::Stop), r#""stop""#);
        assert_eq!(json(RemoteAction::Seek(90.5)), r#"{"seek":90.5}"#);
    }
}
