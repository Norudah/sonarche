//! API keys in the OS keychain.
//!
//! The secret only leaves the keychain on request (to the sidecar, or the
//! reveal button). Whether a key exists is answered from a name-only mirror
//! in `preferences.json`: on macOS, checking existence returns the secret
//! and triggers a password prompt.

use serde::Serialize;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::preferences;

const SERVICE: &str = "com.rpierucci.sonarche";

/// Anything else is rejected at the IPC boundary.
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

/// The only existence check against the keychain (it may prompt). Run once
/// per install to seed the mirror.
fn probe_keychain() -> AppResult<Vec<String>> {
    let mut configured = Vec::new();
    for name in KNOWN_KEYS {
        match entry(name)?.get_password() {
            Ok(value) if !value.trim().is_empty() => configured.push((*name).to_string()),
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            // Locked or refused: report no key, but don't write the mirror, so the next
            // launch asks again.
            Err(err) => return Err(AppError::Keychain(err.to_string())),
        }
    }
    Ok(configured)
}

/// Configured key names, from the mirror; probes the keychain once if the
/// mirror was never written.
pub async fn configured_names(app: &AppHandle) -> AppResult<Vec<String>> {
    if let Some(names) = preferences::load(app).await?.api_keys_configured {
        return Ok(names);
    }
    let probed = tauri::async_runtime::spawn_blocking(probe_keychain)
        .await
        .map_err(|err| AppError::Keychain(err.to_string()))?;
    match probed {
        Ok(names) => {
            preferences::set_api_keys_configured(app, names.clone()).await?;
            Ok(names)
        }
        Err(_) => Ok(Vec::new()),
    }
}

pub async fn list(app: &AppHandle) -> AppResult<Vec<ApiKeyStatus>> {
    let configured = configured_names(app).await?;
    Ok(KNOWN_KEYS
        .iter()
        .map(|name| ApiKeyStatus {
            name: (*name).to_string(),
            configured: configured.iter().any(|held| held == name),
        })
        .collect())
}

/// Reads a key's value: for the sidecar, or the user revealing it.
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

/// Stores or clears (empty value) a key. Keychain first, then the mirror, so
/// the mirror never claims a key that isn't stored.
pub async fn set(app: &AppHandle, name: String, value: String) -> AppResult<ApiKeyStatus> {
    if !KNOWN_KEYS.contains(&name.as_str()) {
        return Err(AppError::InvalidInput(format!("unknown API key: {name}")));
    }
    let trimmed = value.trim().to_string();
    let stored = name.clone();
    let status: ApiKeyStatus = tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&stored)?;
        if trimmed.is_empty() {
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(err) => return Err(AppError::Keychain(err.to_string())),
            }
            return Ok(ApiKeyStatus {
                name: stored,
                configured: false,
            });
        }
        entry
            .set_password(&trimmed)
            .map_err(|err| AppError::Keychain(err.to_string()))?;
        Ok(ApiKeyStatus {
            name: stored,
            configured: true,
        })
    })
    .await
    .map_err(|err| AppError::Keychain(err.to_string()))??;

    // Rebuilt locally: re-probing would prompt.
    let mut names: Vec<String> = preferences::load(app)
        .await?
        .api_keys_configured
        .unwrap_or_default();
    names.retain(|held| held != &name);
    if status.configured {
        names.push(name);
    }
    preferences::set_api_keys_configured(app, names).await?;

    Ok(status)
}
