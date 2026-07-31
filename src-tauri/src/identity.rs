//! How the app names itself to the services it calls.
//!
//! MusicBrainz blocks the default HTTP client string outright and LRCLIB asks
//! callers not to hide behind one, so this is not decoration: it is the
//! difference between an answer and a 403. The version is what makes a
//! misbehaving build traceable to a release, and the bundle identifier is the
//! only address this app has.
//!
//! Its own module because two unrelated callers need the same string — the
//! lyrics lookup and the service probes — and the version has to come from the
//! bundle rather than from a literal somebody remembers to bump. It was written
//! out by hand in the sidecar once, and sat at "Sonarche/1.0" through every
//! release up to 0.9.1.

use tauri::AppHandle;

pub fn user_agent(app: &AppHandle) -> String {
    format!(
        "Sonarche/{} ({})",
        app.package_info().version,
        app.config().identifier
    )
}
