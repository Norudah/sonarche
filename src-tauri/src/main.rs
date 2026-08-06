#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod artist_images;
mod audio_formats;
mod commands;
mod error;
mod genres;
mod identity;
mod jobs;
mod jobs_store;
mod library_align;
mod library_import;
mod library_move;
mod library_scan;
mod logs;
mod lyrics;
mod now_playing;
mod onboarding;
mod player;
mod preferences;
mod proc;
mod python_env;
mod reenrich;
mod reset;
mod settings;
mod sidecar;
mod window_chrome;

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
        .manage(library_align::LibraryAlignState::default())
        .manage(library_import::LibraryImportState::default())
        .manage(player::PlayerState::default())
        .manage(python_env::LibraryRoot::default())
        .setup(|app| {
            // First, so anything that fails after this point leaves a trace.
            logs::init(app.handle());
            let state = jobs::init(app.handle())?;
            app.manage(state);
            // Before anything resolves a path: `AppPaths` reads this state, and
            // an unseeded one resolves to the default library — which would
            // point a moved install back at an empty folder for the length of
            // the first render.
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match preferences::load(&handle).await {
                    Ok(prefs) => handle
                        .state::<python_env::LibraryRoot>()
                        .set(prefs.library_dir.map(Into::into)),
                    Err(err) => eprintln!("[library] could not read the stored location: {err}"),
                }
            });
            // Pushes the playhead and end-of-track to the front; idle until
            // something actually plays.
            player::spawn_status_loop(app.handle().clone());
            // After the window exists, before it is shown to anyone.
            window_chrome::quieten(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_status,
            commands::setup_env,
            commands::check_acoustid_key,
            commands::check_services,
            commands::get_onboarding_state,
            commands::set_onboarding_completed,
            commands::enqueue_download,
            commands::list_jobs,
            commands::retry_job,
            commands::cancel_job,
            commands::clear_job_history,
            commands::list_library,
            commands::reenrich_track,
            commands::recompute_genres,
            commands::fetch_lyrics,
            commands::library_align_scan,
            commands::library_align_apply,
            commands::get_preferences,
            commands::set_rate_limit_delay,
            commands::get_library_location,
            commands::check_library_move,
            commands::move_library,
            commands::delete_track,
            commands::update_tracks,
            commands::allow_cover_preview,
            commands::set_album_cover,
            commands::list_cover_candidates,
            artist_images::list_artist_images,
            artist_images::set_artist_image,
            artist_images::remove_artist_image,
            commands::scan_import_folder,
            commands::start_library_import,
            commands::list_imports,
            commands::list_api_keys,
            commands::set_api_key,
            commands::erase_all_data,
            commands::reinstall_environment,
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
            commands::set_window_theme,
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
