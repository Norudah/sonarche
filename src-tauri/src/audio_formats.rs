//! Which files the engine can turn into sound.
//!
//! Until now the app only ever played what it had downloaded itself — native
//! AAC in an MP4 container, one format, decided by us. Importing someone's
//! existing library ends that: the folder holds whatever they have been
//! collecting for fifteen years, and the answer to "can this be played" has to
//! be something we can state before opening the file, so the import can mark a
//! track rather than discover the problem when the user presses play.
//!
//! The list mirrors the `rodio` features in `Cargo.toml`, and only those. Adding
//! an extension here without the matching feature would make this module lie.

use std::path::Path;

/// Extensions the compiled decoder covers.
///
/// Lowercase, no dot. `m4b` is the audiobook flavour of `m4a` and demuxes the
/// same; `aac` is a raw ADTS stream with no container at all.
const PLAYABLE: &[&str] = &[
    "mp3", // MPEG layer III
    "flac", "m4a", "m4b", "mp4", // AAC or ALAC in an MP4 container
    "aac", // bare ADTS
    "ogg", "oga", // Vorbis — see the caveat on `is_playable`
    "wav", "wave", "aiff", "aif", "aifc",
];

/// Whether the engine can decode this path, judged on its extension alone.
///
/// Extension-only is a deliberate limit, not an oversight: the import scan has
/// to classify thousands of files, and sniffing each one costs a read per file
/// for an answer that is right in all but one case. That case is Ogg — the
/// container carries Vorbis or Opus indifferently, symphonia decodes only the
/// first, and nothing in the name says which. An `.ogg` holding Opus passes
/// here and fails at `decode`, which is why that failure has to stay a spoken
/// error rather than an assertion.
/// The list itself, for the webview.
///
/// The front has to mark a track it will not be able to play, and the only
/// honest way to know is this list — copying it into TypeScript would be a
/// second source of truth that drifts the first time a rodio feature changes.
/// Handed over once and cached there.
pub fn playable_extensions() -> Vec<String> {
    PLAYABLE.iter().map(|ext| (*ext).to_string()).collect()
}

pub fn is_playable(path: &str) -> bool {
    extension_of(path).is_some_and(|ext| PLAYABLE.contains(&ext.as_str()))
}

/// The lowercased extension, or None when the name carries none.
fn extension_of(path: &str) -> Option<String> {
    Path::new(path)
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_the_formats_a_music_library_is_made_of() {
        for path in [
            "/m/a.mp3",
            "/m/a.flac",
            "/m/a.m4a",
            "/m/a.m4b",
            "/m/a.mp4",
            "/m/a.aac",
            "/m/a.ogg",
            "/m/a.oga",
            "/m/a.wav",
            "/m/a.wave",
            "/m/a.aiff",
            "/m/a.aif",
            "/m/a.aifc",
        ] {
            assert!(is_playable(path), "{path} should be playable");
        }
    }

    #[test]
    fn refuses_what_symphonia_cannot_decode() {
        for path in ["/m/a.opus", "/m/a.wma", "/m/a.ape", "/m/a.wv", "/m/a.mpc"] {
            assert!(!is_playable(path), "{path} should not be playable");
        }
    }

    #[test]
    fn ignores_case_because_ripped_files_shout() {
        assert!(is_playable("/m/TRACK.MP3"));
        assert!(is_playable("/m/Track.FlAc"));
    }

    #[test]
    fn a_name_without_an_extension_is_not_playable() {
        assert!(!is_playable("/m/cover"));
        assert!(!is_playable("/m/"));
        assert!(!is_playable(""));
    }

    /// A dotted artist or album name is ordinary — the extension is the last
    /// segment, never the first.
    #[test]
    fn reads_the_last_dot_not_the_first() {
        assert!(is_playable("/m/Godspeed You! Black Emperor/f#a#.mp3"));
        assert!(!is_playable("/m/Sigur Rós/( ).opus"));
    }

    /// A dotfile's name is not an extension: `.mp3` is a hidden file called
    /// "mp3", and `Path::extension` says so.
    #[test]
    fn a_dotfile_is_not_its_own_extension() {
        assert!(!is_playable("/m/.mp3"));
    }
}
