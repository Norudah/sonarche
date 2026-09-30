use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("no compatible Python (>= 3.10) found")]
    PythonNotFound,
    #[error("environment not ready: {0}")]
    EnvNotReady(String),
    #[error("sidecar error: {0}")]
    Sidecar(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("setup failed: {0}")]
    Setup(String),
    #[error("keychain error: {0}")]
    Keychain(String),
    #[error("playback error: {0}")]
    Playback(String),
    /// Its own variant so the front can show it as a track property. The message
    /// prefix is matched by `src/shared/player/playbackError.ts`.
    #[error("unsupported audio format: {0}")]
    UnsupportedFormat(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("jobs database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

// Commands need serializable errors; the front only gets the message.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// The front matches this literal prefix.
    #[test]
    fn the_unsupported_format_wording_is_the_prefix_the_front_matches() {
        let rendered = AppError::UnsupportedFormat("/Music/a.opus".into()).to_string();

        assert_eq!(rendered, "unsupported audio format: /Music/a.opus");
    }
}
