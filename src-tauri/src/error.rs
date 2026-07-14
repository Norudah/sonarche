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
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

// Tauri commands need serializable errors; the frontend only gets the message.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
