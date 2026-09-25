//! Human-readable file names for the `Artwork/` zone, shared by artist
//! images, playlist covers and the launch migration.

/// Also bounds names arriving over IPC.
pub const MAX_STEM_CHARS: usize = 120;

/// A file stem every filesystem accepts: Windows-hostile and control
/// characters become `_`, trailing dots/spaces are removed (Windows strips
/// them silently), and an empty result uses `fallback`.
pub fn file_stem(name: &str, fallback: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']);
    let capped: String = trimmed.chars().take(MAX_STEM_CHARS).collect();
    if capped.is_empty() {
        fallback.to_string()
    } else {
        capped
    }
}

pub fn stem_of(filename: &str) -> &str {
    std::path::Path::new(filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(filename)
}

/// A stem free of collisions, compared case- and extension-insensitively (as
/// macOS and Windows filesystems do). Collisions get a numbered suffix.
pub fn unique_stem(name: &str, fallback: &str, taken: &[String]) -> String {
    let base = file_stem(name, fallback);
    let collides = |candidate: &str| {
        taken
            .iter()
            .any(|held| held.eq_ignore_ascii_case(candidate))
    };
    if !collides(&base) {
        return base;
    }
    let mut count = 2;
    loop {
        let candidate = format!("{base} ({count})");
        if !collides(&candidate) {
            return candidate;
        }
        count += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hostile_characters_become_underscores() {
        assert_eq!(file_stem("AC/DC", "Artwork"), "AC_DC");
        assert_eq!(
            file_stem("What? \"Why\" <Now>", "Artwork"),
            "What_ _Why_ _Now_"
        );
    }

    #[test]
    fn trailing_dots_and_spaces_are_trimmed() {
        assert_eq!(file_stem("N.W.A.", "Artwork"), "N.W.A");
        assert_eq!(file_stem("  Moby  ", "Artwork"), "Moby");
    }

    #[test]
    fn an_emptied_name_falls_back_rather_than_vanishing() {
        assert_eq!(file_stem("...", "Artwork"), "Artwork");
        assert_eq!(file_stem("", "Playlist"), "Playlist");
    }

    #[test]
    fn colliding_stems_get_numbered_case_insensitively() {
        let taken = vec!["AC_DC".to_string(), "iam".to_string()];
        assert_eq!(unique_stem("AC:DC", "x", &taken), "AC_DC (2)");
        assert_eq!(unique_stem("IAM", "x", &taken), "IAM (2)");
        assert_eq!(unique_stem("Daft Punk", "x", &taken), "Daft Punk");
    }

    #[test]
    fn numbering_walks_past_every_taken_slot() {
        let taken = vec!["A".into(), "a (2)".into(), "A (3)".into()];
        assert_eq!(unique_stem("A", "x", &taken), "A (4)");
    }

    #[test]
    fn stem_of_drops_the_extension_only() {
        assert_eq!(stem_of("AC_DC (2).png"), "AC_DC (2)");
        assert_eq!(stem_of("N.W.A.jpg"), "N.W.A");
    }
}
