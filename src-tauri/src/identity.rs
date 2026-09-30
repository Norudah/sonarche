//! The User-Agent sent to external services. MusicBrainz blocks default
//! clients; the version comes from the bundle.

use tauri::AppHandle;

pub fn user_agent(app: &AppHandle) -> String {
    format!(
        "Sonarche/{} ({})",
        app.package_info().version,
        app.config().identifier
    )
}
