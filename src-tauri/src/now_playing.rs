//! The OS media session: media keys, Control Center, lock screen.
//!
//! Stateless: mirrors the track outwards and forwards remote presses as
//! `player:remote` events. Unsupported platforms are no-ops.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
mod macos;

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlayingTrack {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub art_path: Option<String>,
    pub duration: Option<f64>,
}

/// A system control press, forwarded to the front. Only commands the app
/// implements are registered.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RemoteAction {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    /// Absolute position in seconds.
    Seek(f64),
}

/// Transport commands are registered on the first track, so an idle app
/// doesn't take the media keys from other players.
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

pub fn set_playback(is_playing: bool, position: f64) {
    #[cfg(target_os = "macos")]
    macos::set_playback(is_playing, position);
    #[cfg(not(target_os = "macos"))]
    let _ = (is_playing, position);
}

/// Clears the panel so a finished track doesn't look paused.
pub fn clear() {
    #[cfg(target_os = "macos")]
    macos::clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_remote_press_reaches_the_front_in_the_shape_it_reads() {
        // Wire contract: the front matches these exact strings.
        let json = |action: RemoteAction| serde_json::to_string(&action).unwrap();

        assert_eq!(json(RemoteAction::Toggle), r#""toggle""#);
        assert_eq!(json(RemoteAction::Next), r#""next""#);
        assert_eq!(json(RemoteAction::Previous), r#""previous""#);
        assert_eq!(json(RemoteAction::Stop), r#""stop""#);
        assert_eq!(json(RemoteAction::Seek(90.5)), r#"{"seek":90.5}"#);
    }
}
