//! API key storage backed by the OS keychain (macOS Keychain via the Security
//! framework). The raw secret is never sent back to the webview — the frontend
//! only ever learns whether a key is configured.

use serde::Serialize;

use crate::error::{AppError, AppResult};

const SERVICE: &str = "com.rpierucci.sonarche";

/// Keys the app understands; anything else is rejected at the IPC boundary.
const KNOWN_KEYS: &[&str] = &["acoustid"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub name: String,
    pub configured: bool,
}

fn entry(name: &str) -> AppResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, name).map_err(|err| AppError::Keychain(err.to_string()))
}

fn is_configured(name: &str) -> AppResult<bool> {
    match entry(name)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(err) => Err(AppError::Keychain(err.to_string())),
    }
}

pub async fn list() -> AppResult<Vec<ApiKeyStatus>> {
    // Keychain access is blocking; keep it off the async runtime.
    tauri::async_runtime::spawn_blocking(|| {
        KNOWN_KEYS
            .iter()
            .map(|name| {
                Ok(ApiKeyStatus {
                    name: name.to_string(),
                    configured: is_configured(name)?,
                })
            })
            .collect()
    })
    .await
    .map_err(|err| AppError::Keychain(err.to_string()))?
}

/// Read a key's value for internal use (e.g. handed to the sidecar).
/// Never exposed over IPC.
pub async fn read(name: &str) -> AppResult<Option<String>> {
    let name = name.to_string();
    tauri::async_runtime::spawn_blocking(move || match entry(&name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(AppError::Keychain(err.to_string())),
    })
    .await
    .map_err(|err| AppError::Keychain(err.to_string()))?
}

/// Store (or clear, when the value is empty) one API key.
pub async fn set(name: String, value: String) -> AppResult<ApiKeyStatus> {
    if !KNOWN_KEYS.contains(&name.as_str()) {
        return Err(AppError::InvalidInput(format!("unknown API key: {name}")));
    }
    let trimmed = value.trim().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&name)?;
        if trimmed.is_empty() {
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(err) => return Err(AppError::Keychain(err.to_string())),
            }
            return Ok(ApiKeyStatus {
                name,
                configured: false,
            });
        }
        entry
            .set_password(&trimmed)
            .map_err(|err| AppError::Keychain(err.to_string()))?;
        Ok(ApiKeyStatus {
            name,
            configured: true,
        })
    })
    .await
    .map_err(|err| AppError::Keychain(err.to_string()))?
}
