//! Tauri commands, one module per domain. Keep them thin: validate the
//! input, then delegate.

pub mod artist_images;
pub mod covers;
pub mod downloads;
pub mod imports;
pub mod library;
pub mod maintenance;
pub mod organize;
pub mod player;
pub mod playlists;
pub mod preferences;
pub mod setup;

use std::time::Duration;

use crate::error::{AppError, AppResult};

const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// Bounds the free-text category, which is written to every file's tags.
const MAX_CATEGORY_CHARS: usize = 100;

/// Trims a free-text category; empty means none. Only the length is bounded:
/// the UI's taxonomy is a starter set.
fn checked_category(category: Option<String>) -> AppResult<Option<String>> {
    match category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
    {
        Some(c) if c.chars().count() > MAX_CATEGORY_CHARS => {
            Err(AppError::InvalidInput("category is too long".into()))
        }
        other => Ok(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_blank_category_means_none() {
        assert_eq!(checked_category(None).unwrap(), None);
        assert_eq!(checked_category(Some("   ".into())).unwrap(), None);
    }

    #[test]
    fn a_category_is_trimmed() {
        assert_eq!(
            checked_category(Some("  Films ".into())).unwrap(),
            Some("Films".into())
        );
    }

    #[test]
    fn the_bound_counts_characters_not_bytes() {
        let accented = "é".repeat(MAX_CATEGORY_CHARS);
        assert!(checked_category(Some(accented.clone())).is_ok());
        assert!(checked_category(Some(format!("{accented}é"))).is_err());
    }
}
