//! The bundled binaries: fpcalc and ffmpeg (copied on first use) and deno (run in place).

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

use super::paths::AppPaths;

/// Chromaprint's fingerprinter, fetched and checksummed at build time by
/// `scripts/prepare-runtime.mjs`.
pub(super) const FPCALC_BIN: &str = if cfg!(windows) {
    "fpcalc.exe"
} else {
    "fpcalc"
};

/// Static ffmpeg (same provenance), used to remux fragmented DASH m4a into
/// classic MP4 so Music.app, iOS and CarPlay read real durations.
pub(super) const FFMPEG_BIN: &str = if cfg!(windows) {
    "ffmpeg.exe"
} else {
    "ffmpeg"
};

/// JavaScript runtime yt-dlp needs to descramble YouTube stream URLs.
pub(super) const DENO_BIN: &str = if cfg!(windows) { "deno.exe" } else { "deno" };

/// Copies the bundled fpcalc into the tools dir on first use. A failure only
/// degrades enrichment.
///
/// Fetched at build time rather than at runtime: an unsigned app downloading
/// and running an executable looks like a dropper to antivirus software.
pub async fn ensure_fpcalc(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "fpcalc",
        &paths.bundled_fpcalc,
        &paths.fpcalc(),
        &paths.tools_dir,
    )
    .await
}

pub async fn ensure_ffmpeg(paths: &AppPaths) -> AppResult<()> {
    ensure_tool(
        "ffmpeg",
        &paths.bundled_ffmpeg,
        &paths.ffmpeg(),
        &paths.tools_dir,
    )
    .await
}

/// The bundled deno, if this build has one. `None` means downloads fall back
/// to the single client that needs no JavaScript.
pub async fn deno(paths: &AppPaths) -> Option<PathBuf> {
    tokio::fs::try_exists(&paths.bundled_deno)
        .await
        .unwrap_or(false)
        .then(|| paths.bundled_deno.clone())
}

async fn ensure_tool(name: &str, source: &Path, dest: &Path, tools_dir: &Path) -> AppResult<()> {
    if tokio::fs::try_exists(dest).await.unwrap_or(false) {
        return Ok(());
    }
    if !tokio::fs::try_exists(source).await.unwrap_or(false) {
        return Err(AppError::Setup(format!(
            "{name} is missing from this build (expected {}) — run `npm run prepare:runtime`",
            source.display()
        )));
    }

    tokio::fs::create_dir_all(tools_dir).await?;
    tokio::fs::copy(source, dest).await?;

    // The bundler isn't guaranteed to preserve the executable bit.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(dest, std::fs::Permissions::from_mode(0o755)).await?;
    }

    eprintln!("[tools] {name} ready at {}", dest.display());
    Ok(())
}
