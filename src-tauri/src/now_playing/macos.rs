//! macOS media session via `MPNowPlayingInfoCenter` (what the panel shows)
//! and `MPRemoteCommandCenter` (media keys, Control Center, lock screen).
//!
//! Every call is an Objective-C message Rust can't check. The unsafety is
//! uniform and shallow (strings, numbers, blocks), so it is justified once
//! per function rather than per line.

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

/// Registered once per process; re-registering would stack handlers.
static COMMANDS_ATTACHED: AtomicBool = AtomicBool::new(false);

/// Artwork is set synchronously: `NSImage` loads lazily, so this is cheap and
/// the panel never pairs the old cover with the new title.
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

/// Merged into the existing dictionary: a fresh one would drop title and artwork.
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

/// `Stopped` rather than an empty panel, so a finished track doesn't look paused.
pub fn clear() {
    autoreleasepool(|_| unsafe {
        MPNowPlayingInfoCenter::defaultCenter()
            .setPlaybackState(MPNowPlayingPlaybackState::Stopped);
    });
}

/// Registers the transport commands once. `on_action` runs on the OS's thread.
pub fn attach_commands(on_action: impl Fn(RemoteAction) + Send + Sync + 'static) {
    if COMMANDS_ATTACHED.swap(true, Ordering::SeqCst) {
        return;
    }

    autoreleasepool(|_| unsafe {
        let center = MPRemoteCommandCenter::sharedCommandCenter();
        let on_action = std::sync::Arc::new(on_action);

        // Only commands the queue can honour; others would show dead buttons.
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

        // Handlers receive the base event type; this command always delivers the
        // subclass carrying the position.
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

/// The image plus the resize block the system calls; each owns the next.
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

/// Apple's keys are `NSString`s; the setter takes the `NSCopying` protocol.
fn key(name: &NSString) -> &ProtocolObject<dyn NSCopying> {
    ProtocolObject::from_ref(name)
}

fn string(value: &str) -> Retained<NSString> {
    NSString::from_str(value)
}

fn number(value: f64) -> Retained<NSNumber> {
    NSNumber::new_f64(value)
}
