//! An image pasted from the clipboard, landed as a temp file.
//!
//! The crop/rendition pipeline downstream works on file paths (the sidecar
//! reads a `source_path` like any picked file), so pasted bytes must touch
//! disk once. The webview ships them raw over IPC; this side re-runs the same
//! admission the sidecar applies to a pasted link — magic-byte sniff over any
//! declared type, and the same size ceiling.

use std::time::Duration;

use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

/// Same ceiling as the sidecar's link fetch (`artist_image.MAX_FETCH_BYTES`):
/// one paste is a one-off personal image, not a bulk channel.
const MAX_PASTE_BYTES: usize = 30 * 1024 * 1024;

/// Temp-file families the app creates for an image on its way into a modal:
/// a clipboard paste (written here) and a fetched link (written by the
/// sidecar, `artist_image.fetch`). Both live exactly as long as the modal
/// needs them — nothing deletes them on cancel, so a sweep must.
const SWEEP_PREFIXES: &[&str] = &["sonarche-paste-", "sonarche-fetch-"];

/// Old enough that no open modal can still be holding the file. Windows never
/// cleans %TEMP% on its own, so without this the files pile up forever there.
const SWEEP_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

fn is_ours(name: &str) -> bool {
    SWEEP_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// Remove image temp files a past session left behind. Called once at launch,
/// off the main thread; best-effort on purpose — a locked file must not
/// trouble startup.
pub fn sweep_stale() {
    let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if !is_ours(name) {
            continue;
        }
        let stale = entry
            .metadata()
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|modified| modified.elapsed().ok())
            .is_some_and(|age| age > SWEEP_MAX_AGE);
        if stale {
            if let Err(err) = std::fs::remove_file(entry.path()) {
                eprintln!("[pasted-image] sweep failed for {name}: {err}");
            }
        }
    }
}

/// The suffix the bytes actually are, or None when they are not an image we
/// handle — mirrors `artist_image.sniff_suffix` in the sidecar.
fn sniff_suffix(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(b"\xff\xd8\xff") {
        return Some(".jpg");
    }
    if data.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some(".png");
    }
    if data.len() >= 12 && data.starts_with(b"RIFF") && &data[8..12] == b"WEBP" {
        return Some(".webp");
    }
    None
}

/// Write clipboard image bytes into a temp file the modal then adopts exactly
/// like a local pick. `(async)` so the disk write never runs on the main
/// thread; the raw IPC body needs the borrowed `Request`, which a real async
/// fn cannot take.
#[tauri::command(async)]
pub fn save_pasted_image(request: tauri::ipc::Request<'_>) -> AppResult<Value> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err(AppError::InvalidInput("expected raw image bytes".into()));
    };
    if data.is_empty() {
        return Err(AppError::InvalidInput("empty clipboard image".into()));
    }
    if data.len() > MAX_PASTE_BYTES {
        return Err(AppError::InvalidInput("image too large".into()));
    }
    let suffix = sniff_suffix(data)
        .ok_or_else(|| AppError::InvalidInput("the clipboard did not hold an image".into()))?;

    let path = std::env::temp_dir().join(format!(
        "sonarche-paste-{}{suffix}",
        Uuid::new_v4().simple()
    ));
    std::fs::write(&path, data)?;
    Ok(json!({
        "path": path.to_string_lossy(),
        "bytes": data.len(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_signatures_are_recognised() {
        assert_eq!(sniff_suffix(b"\xff\xd8\xff\xe0rest"), Some(".jpg"));
        assert_eq!(sniff_suffix(b"\x89PNG\r\n\x1a\nrest"), Some(".png"));
        assert_eq!(sniff_suffix(b"RIFF\x00\x00\x00\x00WEBPrest"), Some(".webp"));
    }

    /// A hotlink-protection page or a copied text both arrive as bytes too —
    /// nothing but the signature decides.
    /// The sweep must never look past its own families: the OS temp dir is
    /// shared with every other program on the machine.
    #[test]
    fn the_sweep_only_recognises_our_files() {
        assert!(is_ours("sonarche-paste-abc123.jpg"));
        assert!(is_ours("sonarche-fetch-xyz.png"));
        assert!(!is_ours("sonarche-scan-something"));
        assert!(!is_ours("unrelated.jpg"));
        assert!(!is_ours("paste-sonarche.jpg"));
    }

    #[test]
    fn non_images_are_refused() {
        assert_eq!(sniff_suffix(b"<html><body>nope</body></html>"), None);
        assert_eq!(sniff_suffix(b"GIF89a"), None);
        assert_eq!(sniff_suffix(b""), None);
        assert_eq!(sniff_suffix(b"RIFF\x00\x00\x00\x00WAVE"), None);
    }
}
