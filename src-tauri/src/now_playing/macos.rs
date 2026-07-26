//! The macOS media session, spoken to directly.
//!
//! Two Apple objects do all of it. `MPNowPlayingInfoCenter` is a dictionary the
//! system reads to draw the Now Playing panel — title, artist, artwork, length,
//! playhead. `MPRemoteCommandCenter` is the other direction: the F7/F8/F9 keys,
//! the Control Center transport and the lock screen's scrubber all arrive as
//! commands, and a command with no handler is a button the OS still draws and
//! that does nothing.
//!
//! Everything here is `unsafe` because every call is a message to Objective-C,
//! which Rust cannot check. The unsafety is uniform and shallow — the arguments
//! are strings, numbers and blocks — so it is asserted once per function rather
//! than per line.

use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};

use block2::RcBlock;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2::AnyThread;
use objc2_app_kit::NSImage;
use objc2_core_foundation::CGSize;
use objc2_foundation::{NSCopying, NSMutableDictionary, NSNumber, NSString};
use objc2_media_player::{
    MPChangePlaybackPositionCommandEvent, MPMediaItemArtwork, MPMediaItemPropertyAlbumTitle,
    MPMediaItemPropertyArtist, MPMediaItemPropertyArtwork, MPMediaItemPropertyPlaybackDuration,
    MPMediaItemPropertyTitle, MPNowPlayingInfoCenter, MPNowPlayingInfoPropertyElapsedPlaybackTime,
    MPNowPlayingPlaybackState, MPRemoteCommandCenter, MPRemoteCommandEvent,
    MPRemoteCommandHandlerStatus,
};

use crate::now_playing::{NowPlayingTrack, RemoteAction};

/// Whether the transport commands have been registered. They are registered
/// once for the app's life: the session belongs to the process, not to a track,
/// and re-registering would stack handlers on the same button.
static COMMANDS_ATTACHED: AtomicBool = AtomicBool::new(false);

/// Describe the track the OS should show.
///
/// The artwork is set in the same pass rather than loaded in the background:
/// `NSImage` reads the file lazily, so this costs an open and a header, and the
/// panel never shows the previous cover next to the new title.
pub fn set_track(track: &NowPlayingTrack) {
    autoreleasepool(|_| unsafe {
        let info = NSMutableDictionary::<NSString, AnyObject>::new();

        if let Some(title) = &track.title {
            info.setObject_forKey(&*string(title), key(MPMediaItemPropertyTitle));
        }
        if let Some(artist) = &track.artist {
            info.setObject_forKey(&*string(artist), key(MPMediaItemPropertyArtist));
        }
        if let Some(album) = &track.album {
            info.setObject_forKey(&*string(album), key(MPMediaItemPropertyAlbumTitle));
        }
        if let Some(duration) = track.duration {
            info.setObject_forKey(&*number(duration), key(MPMediaItemPropertyPlaybackDuration));
        }
        if let Some(artwork) = track.art_path.as_deref().and_then(artwork) {
            info.setObject_forKey(&artwork, key(MPMediaItemPropertyArtwork));
        }

        MPNowPlayingInfoCenter::defaultCenter().setNowPlayingInfo(Some(&info.into_super()));
    });
}

/// Mirror the transport. `position` is what keeps the lock screen's scrubber
/// honest, and it has to be merged into the existing dictionary — handing the
/// centre a fresh one would drop the title and the artwork with it.
pub fn set_playback(is_playing: bool, position: f64) {
    autoreleasepool(|_| unsafe {
        let center = MPNowPlayingInfoCenter::defaultCenter();
        center.setPlaybackState(if is_playing {
            MPNowPlayingPlaybackState::Playing
        } else {
            MPNowPlayingPlaybackState::Paused
        });

        let info = NSMutableDictionary::<NSString, AnyObject>::new();
        if let Some(previous) = center.nowPlayingInfo() {
            info.addEntriesFromDictionary(&previous);
        }
        info.setObject_forKey(
            &*number(position.max(0.0)),
            key(MPNowPlayingInfoPropertyElapsedPlaybackTime),
        );
        center.setNowPlayingInfo(Some(&info.into_super()));
    });
}

/// Nothing is loaded any more. The state goes to `Stopped` rather than the
/// panel being emptied: a finished track left sitting there reads as paused.
pub fn clear() {
    autoreleasepool(|_| unsafe {
        MPNowPlayingInfoCenter::defaultCenter()
            .setPlaybackState(MPNowPlayingPlaybackState::Stopped);
    });
}

/// Register the transport commands, once. `on_action` is called from whatever
/// thread the OS delivers the press on.
pub fn attach_commands(on_action: impl Fn(RemoteAction) + Send + Sync + 'static) {
    if COMMANDS_ATTACHED.swap(true, Ordering::SeqCst) {
        return;
    }

    autoreleasepool(|_| unsafe {
        let center = MPRemoteCommandCenter::sharedCommandCenter();
        let on_action = std::sync::Arc::new(on_action);

        // Only the commands the queue has an answer for. Enabling one we cannot
        // honour would show the user a button that does nothing.
        for (command, action) in [
            (center.playCommand(), RemoteAction::Play),
            (center.pauseCommand(), RemoteAction::Pause),
            (center.togglePlayPauseCommand(), RemoteAction::Toggle),
            (center.nextTrackCommand(), RemoteAction::Next),
            (center.previousTrackCommand(), RemoteAction::Previous),
            (center.stopCommand(), RemoteAction::Stop),
        ] {
            let on_action = on_action.clone();
            let handler = RcBlock::new(move |_event: NonNull<_>| {
                on_action(action);
                MPRemoteCommandHandlerStatus::Success
            });
            command.setEnabled(true);
            command.addTargetWithHandler(&handler);
        }

        // The scrubber is the one command that carries a value. Every command
        // hands its handler the base event type, and this one always delivers
        // the subclass that has the position on it.
        let position = center.changePlaybackPositionCommand();
        let handler = RcBlock::new(move |event: NonNull<MPRemoteCommandEvent>| {
            let Some(event) = event
                .as_ref()
                .downcast_ref::<MPChangePlaybackPositionCommandEvent>()
            else {
                return MPRemoteCommandHandlerStatus::CommandFailed;
            };
            on_action(RemoteAction::Seek(event.positionTime()));
            MPRemoteCommandHandlerStatus::Success
        });
        position.setEnabled(true);
        position.addTargetWithHandler(&handler);
    });
}

/// The cover as the panel wants it: an image, plus a block the system calls to
/// resize it. The block owns the image, and the artwork owns the block, so the
/// three live and die together.
fn artwork(path: &str) -> Option<Retained<MPMediaItemArtwork>> {
    unsafe {
        let image = NSImage::initWithContentsOfFile(NSImage::alloc(), &string(path))?;
        let size = image.size();
        let handler = RcBlock::new(move |_requested: CGSize| NonNull::from(&*image));
        Some(MPMediaItemArtwork::initWithBoundsSize_requestHandler(
            MPMediaItemArtwork::alloc(),
            size,
            &handler,
        ))
    }
}

/// A dictionary key. The keys Apple exports are `NSString`s, but the setter
/// takes the protocol every key conforms to.
fn key(name: &NSString) -> &ProtocolObject<dyn NSCopying> {
    ProtocolObject::from_ref(name)
}

fn string(value: &str) -> Retained<NSString> {
    NSString::from_str(value)
}

fn number(value: f64) -> Retained<NSNumber> {
    NSNumber::new_f64(value)
}
