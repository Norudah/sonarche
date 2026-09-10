//! API key storage backed by the OS keychain (macOS Keychain via the Security
//! framework).
//!
//! Two rules, and the second one is newer than the first:
//!
//! 1. The secret leaves the keychain only when someone asks for it — the app
//!    itself, to hand it to the sidecar, or the user, through the reveal button
//!    on the key's own card. Nothing else, and never as a side effect.
//! 2. *Whether* a key exists is answered from a mirror in `preferences.json`,
//!    not from the keychain. macOS has no "does this entry exist" that does not
//!    also hand over the secret, and it guards that with a password dialog — so
//!    the launch path, which only wanted to know if the optional AcoustID step
//!    was done, put a password box on screen before the window had painted.
//!    The mirror holds names, never values; the keychain remains the only place
//!    a secret is stored.

use serde::Serialize;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::preferences;

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

/// The one function that still asks the keychain whether an entry exists, and
/// therefore the one that can raise a password prompt. Called once per install,
/// by the migration below.
fn probe_keychain() -> AppResult<Vec<String>> {
    let mut configured = Vec::new();
    for name in KNOWN_KEYS {
        match entry(name)?.get_password() {
            Ok(value) if !value.trim().is_empty() => configured.push((*name).to_string()),
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            // A locked keychain or a refused prompt is not "no key" forever —
            // but it is "no key" for now, and the mirror is not written, so the
            // next launch asks again rather than freezing a wrong answer.
            Err(err) => return Err(AppError::Keychain(err.to_string())),
        }
    }
    Ok(configured)
}

/// Which keys are on file, from the mirror — no keychain, no prompt.
///
/// The mirror being absent means this install has never written one: probe
/// once, record the answer, and never ask again. A probe that fails answers
/// "none" for this call and leaves the mirror unwritten, so a keychain that was
/// locked at launch is re-read next time instead of being remembered as empty.
pub async fn configured_names(app: &AppHandle) -> AppResult<Vec<String>> {
    if let Some(names) = preferences::load(app).await?.api_keys_configured {
        return Ok(names);
    }
    // Keychain access is blocking; keep it off the async runtime.
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

/// Read a key's value.
///
/// Two callers, both of them deliberate: the app handing the key to the
/// sidecar, and the reveal button on the key's own card — which is a person
/// asking to see their own secret, and the one moment a keychain prompt is
/// exactly the right thing to happen.
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
///
/// Writes the keychain first and the mirror second: a mirror that claims a key
/// the keychain does not hold sends the user to a card that says "configured"
/// over a service that refuses every request.
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

    // Rebuilt from what we just did rather than re-probed: re-probing would
    // cost the prompt this whole mirror exists to avoid.
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
