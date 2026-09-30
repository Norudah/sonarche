//! Which files the engine can decode, judged by extension so imports can flag
//! unplayable tracks up front. Mirrors the `rodio` features in `Cargo.toml`.

use std::path::Path;

/// Lowercase, no dot. `m4b` demuxes like `m4a`; `aac` is raw ADTS.
const PLAYABLE: &[&str] = &[
    "mp3", // MPEG layer III
    "flac", "m4a", "m4b", "mp4", // AAC or ALAC in an MP4 container
    "aac", // bare ADTS
    "ogg", "oga", // Vorbis — see the caveat on `is_playable`
    "wav", "wave", "aiff", "aif", "aifc",
];

/// The playable extensions, for the webview (so TypeScript keeps no copy).
pub fn playable_extensions() -> Vec<String> {
    PLAYABLE.iter().map(|ext| (*ext).to_string()).collect()
}

/// By extension only: an `.ogg` holding Opus passes here and fails at decode.
pub fn is_playable(path: &str) -> bool {
    extension_of(path).is_some_and(|ext| PLAYABLE.contains(&ext.as_str()))
}

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

    /// The extension is the last segment, not the first.
    #[test]
    fn reads_the_last_dot_not_the_first() {
        assert!(is_playable("/m/Godspeed You! Black Emperor/f#a#.mp3"));
        assert!(!is_playable("/m/Sigur Rós/( ).opus"));
    }

    /// `.mp3` is a hidden file named "mp3", not an extension.
    #[test]
    fn a_dotfile_is_not_its_own_extension() {
        assert!(!is_playable("/m/.mp3"));
    }
}
