//! Where everything the app owns lives on disk.

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::AppResult;

use super::tools::{DENO_BIN, FFMPEG_BIN, FPCALC_BIN};

pub struct AppPaths {
    pub venv_dir: PathBuf,
    pub staging_dir: PathBuf,
    pub beets_config: PathBuf,
    /// Library-import variant of the config; see `write_beets_config`.
    pub beets_import_config: PathBuf,
    /// beets' incremental-import state, placed explicitly so a library erase can
    /// delete it (a stale one makes beets skip every folder it has seen).
    pub beets_import_state: PathBuf,
    pub beets_db: PathBuf,
    /// The user-chosen library folder. Beets only sees `music_dir()`.
    pub library_root: PathBuf,
    pub sidecar_main: PathBuf,
    pub requirements: PathBuf,
    /// Bundled base genre tree/whitelist (read-only). The beets config points at
    /// the derived copies in [`Self::genres_dir`].
    pub genres_tree: PathBuf,
    pub genres_whitelist: PathBuf,
    /// User genre placements and the derived tree/whitelist, kept outside the
    /// library so an erase doesn't remove them.
    pub genres_dir: PathBuf,
    pub tools_dir: PathBuf,
    /// The bundled interpreter as an archive; `tar` restores its symlinks and
    /// executable bits.
    pub python_archive: PathBuf,
    pub runtime_dir: PathBuf,
    /// Bundled wheels, so the install needs no network.
    pub wheels_dir: PathBuf,
    /// Read-only (inside the signed `.app` on macOS); copied by [`ensure_fpcalc`].
    pub bundled_fpcalc: PathBuf,
    pub bundled_ffmpeg: PathBuf,
    /// Run in place, never copied (81 MB). See [`deno`].
    pub bundled_deno: PathBuf,
    /// Kept in app data rather than the user's cache folder.
    pub deno_cache_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve(app: &AppHandle) -> AppResult<Self> {
        let data = app.path().app_data_dir()?;
        let sidecar_dir = app
            .path()
            .resolve("sidecar", tauri::path::BaseDirectory::Resource)?;
        let resource = |name: &str| {
            app.path()
                .resolve(name, tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| data.join(name))
        };
        let library_root = app
            .try_state::<LibraryRoot>()
            .and_then(|root| root.get())
            .unwrap_or_else(|| default_library_dir(app));
        Ok(Self {
            venv_dir: data.join("venv"),
            staging_dir: data.join("staging"),
            beets_config: data.join("beets").join("config.yaml"),
            beets_import_config: data.join("beets").join("config-import.yaml"),
            beets_import_state: data.join("beets").join("import-state.pickle"),
            beets_db: data.join("beets").join("library.db"),
            library_root,
            sidecar_main: sidecar_dir.join("main.py"),
            requirements: sidecar_dir.join("requirements.txt"),
            genres_tree: sidecar_dir.join("genres-tree.yaml"),
            genres_whitelist: sidecar_dir.join("genres-whitelist.txt"),
            genres_dir: data.join("genres"),
            tools_dir: data.join("tools"),
            python_archive: resource("python.tar.gz"),
            runtime_dir: data.join("runtime"),
            wheels_dir: resource("wheels"),
            bundled_fpcalc: resource("tools").join(FPCALC_BIN),
            bundled_ffmpeg: resource("tools").join(FFMPEG_BIN),
            bundled_deno: resource("tools").join(DENO_BIN),
            deno_cache_dir: data.join("deno"),
        })
    }

    /// Bundled base + user placements; named by the beets config, written by the
    /// sidecar.
    pub fn derived_genres_tree(&self) -> PathBuf {
        self.genres_dir.join("genres-tree.yaml")
    }

    pub fn derived_genres_whitelist(&self) -> PathBuf {
        self.genres_dir.join("genres-whitelist.txt")
    }

    /// beets' `directory:`, the only folder the sidecar organizes.
    pub fn music_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::MUSIC_DIR)
    }

    pub fn artwork_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::ARTWORK_DIR)
    }

    /// Indexed by the `artist_images` table.
    pub fn artist_images_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_ARTISTS)
    }

    pub fn playlist_covers_dir(&self) -> PathBuf {
        self.artwork_dir()
            .join(crate::library_layout::ARTWORK_PLAYLISTS)
    }

    /// Write-only M3U8 mirror; see `playlists_mirror`.
    pub fn playlists_dir(&self) -> PathBuf {
        self.library_root.join(crate::library_layout::PLAYLISTS_DIR)
    }

    pub fn venv_python(&self) -> PathBuf {
        if cfg!(windows) {
            self.venv_dir.join("Scripts").join("python.exe")
        } else {
            self.venv_dir.join("bin").join("python3")
        }
    }

    /// The unpacked bundled interpreter; absent before setup or in builds
    /// without a bundled runtime. Windows keeps it at the tree root.
    pub fn runtime_python(&self) -> PathBuf {
        let root = self.runtime_dir.join("python");
        if cfg!(windows) {
            root.join("python.exe")
        } else {
            root.join("bin").join("python3")
        }
    }

    pub fn fpcalc(&self) -> PathBuf {
        self.tools_dir.join(FPCALC_BIN)
    }

    pub fn ffmpeg(&self) -> PathBuf {
        self.tools_dir.join(FFMPEG_BIN)
    }
}

/// The library location when moved off the default.
///
/// Held in managed state because [`AppPaths::resolve`] runs on nearly every
/// command and must not read a file on the async runtime.
#[derive(Default)]
pub struct LibraryRoot(std::sync::RwLock<Option<PathBuf>>);

impl LibraryRoot {
    pub fn get(&self) -> Option<PathBuf> {
        self.0.read().ok().and_then(|guard| guard.clone())
    }

    pub fn set(&self, dir: Option<PathBuf>) {
        if let Ok(mut guard) = self.0.write() {
            *guard = dir;
        }
    }
}

/// `Sonarche` in the platform's music folder, else in app data.
pub fn default_library_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .audio_dir()
        .map(|dir| dir.join(crate::library_layout::FOLDER_NAME))
        .unwrap_or_else(|_| {
            app.path()
                .app_data_dir()
                .map(|dir| dir.join("Library"))
                .unwrap_or_else(|_| PathBuf::from("Library"))
        })
}
