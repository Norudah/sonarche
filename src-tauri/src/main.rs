#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod artist_images;
mod artwork;
mod audio_formats;
mod commands;
mod convert;
mod download_undo;
mod error;
mod genres;
mod identity;
mod import_undo;
mod jobs;
mod jobs_store;
mod library_align;
mod library_import;
mod library_layout;
mod library_move;
mod library_scan;
mod logs;
mod lyrics;
mod now_playing;
mod onboarding;
mod pasted_image;
mod player;
mod playlists;
mod playlists_mirror;
mod preferences;
mod proc;
mod python_env;
mod reenrich;
mod remux;
mod reset;
mod settings;
mod sidecar;
mod window_chrome;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // For sending the user to acoustid.org; scoped in `capabilities/default.json`.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Read-only, for pasting images.
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(sidecar::SidecarState::default())
        .manage(reenrich::ReenrichState::default())
        .manage(remux::RemuxState::default())
        .manage(genres::RecomputeGenresState::default())
        .manage(convert::ConvertLibraryState::default())
        .manage(library_align::LibraryAlignState::default())
        .manage(library_import::LibraryImportState::default())
        .manage(player::PlayerState::default())
        .manage(python_env::LibraryRoot::default())
        .setup(|app| {
            // First, so later failures leave a trace.
            logs::init(app.handle());
            // Stale image temp files, swept off-thread.
            tauri::async_runtime::spawn_blocking(pasted_image::sweep_stale);
            // Before anything resolves a path, or a moved library would resolve to the
            // default location.
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match preferences::load(&handle).await {
                    Ok(prefs) => handle
                        .state::<python_env::LibraryRoot>()
                        .set(prefs.library_dir.map(Into::into)),
                    Err(err) => eprintln!("[library] could not read the stored location: {err}"),
                }
            });
            // The worker starts only after the launch migration.
            let (state, worker) = jobs::init(app.handle())?;
            library_layout::run_launch_migration(app.handle(), &state);
            playlists_mirror::sync_at_launch(app.handle(), &state);
            state.start(app.handle().clone(), worker);
            app.manage(state);
            player::spawn_status_loop(app.handle().clone());
            window_chrome::quieten(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_status,
            commands::setup_env,
            commands::reveal_log_file,
            commands::check_acoustid_key,
            commands::check_services,
            commands::get_onboarding_state,
            commands::set_onboarding_completed,
            commands::enqueue_download,
            commands::list_jobs,
            commands::list_jobs_page,
            commands::download_target_albums,
            commands::retry_job,
            commands::cancel_job,
            commands::clear_job_history,
            commands::preview_download_undo,
            commands::undo_download,
            commands::change_job_destination,
            commands::list_library,
            commands::playable_extensions,
            commands::reenrich_track,
            commands::remux_library,
            commands::recompute_genres,
            commands::set_audio_format,
            commands::convert_library,
            commands::fetch_lyrics,
            commands::library_align_scan,
            commands::library_align_apply,
            commands::get_preferences,
            commands::set_rate_limit_delay,
            commands::get_home_tour_seen,
            commands::set_home_tour_seen,
            commands::get_library_location,
            commands::check_library_move,
            commands::move_library,
            commands::delete_track,
            commands::update_tracks,
            commands::move_tracks,
            commands::set_album_kind,
            commands::set_genre_family,
            commands::list_genre_overrides,
            commands::set_check_accepted,
            commands::allow_cover_preview,
            commands::album_recrop_source,
            commands::set_album_cover,
            commands::list_cover_candidates,
            artist_images::list_artist_images,
            artist_images::set_artist_image,
            artist_images::remove_artist_image,
            artist_images::fetch_artist_image_url,
            pasted_image::save_pasted_image,
            playlists::list_playlists,
            playlists::create_playlist,
            playlists::rename_playlist,
            playlists::delete_playlist,
            playlists::add_playlist_tracks,
            playlists::remove_playlist_tracks,
            playlists::move_playlist_track,
            playlists::set_playlist_cover,
            playlists::remove_playlist_cover,
            playlists::set_playlist_marker,
            commands::scan_import_folder,
            commands::start_library_import,
            commands::cancel_library_import,
            commands::list_imports,
            commands::preview_import_undo,
            commands::undo_import,
            commands::list_api_keys,
            commands::reveal_api_key,
            commands::set_api_key,
            commands::erase_all_data,
            commands::erase_library,
            commands::erase_artist_images,
            commands::erase_playlists,
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
