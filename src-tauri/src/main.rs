#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio_formats;
mod commands;
mod dev_reset;
mod error;
mod genres;
mod jobs;
mod jobs_store;
mod library_import;
mod library_scan;
mod now_playing;
mod onboarding;
mod player;
mod preferences;
mod proc;
mod python_env;
mod reenrich;
mod settings;
mod sidecar;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // The walkthrough has to hand the user off to acoustid.org to get a key,
        // and a webview cannot open a browser on its own. Scoped to that one
        // host in `capabilities/default.json`.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(sidecar::SidecarState::default())
        .manage(reenrich::ReenrichState::default())
        .manage(genres::RecomputeGenresState::default())
        .manage(library_import::LibraryImportState::default())
        .manage(player::PlayerState::default())
        .setup(|app| {
            let state = jobs::init(app.handle())?;
            app.manage(state);
            // Pushes the playhead and end-of-track to the front; idle until
            // something actually plays.
            player::spawn_status_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_status,
            commands::setup_env,
            commands::check_acoustid_key,
            commands::get_onboarding_state,
            commands::set_onboarding_completed,
            commands::enqueue_download,
            commands::list_jobs,
            commands::retry_job,
            commands::clear_job_history,
            commands::list_library,
            commands::reenrich_track,
            commands::recompute_genres,
            commands::get_preferences,
            commands::set_rate_limit_delay,
            commands::delete_track,
            commands::update_tracks,
            commands::scan_import_folder,
            commands::start_library_import,
            commands::list_api_keys,
            commands::set_api_key,
            commands::reset_setup_dev,
            commands::reset_library_dev,
            commands::player_load,
            commands::player_enqueue,
            commands::player_toggle,
            commands::player_pause,
            commands::player_seek,
            commands::player_set_volume,
            commands::player_stop,
            commands::player_status,
            commands::now_playing_set,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<sidecar::SidecarState>();
                tauri::async_runtime::block_on(state.shutdown());
            }
        });
}
