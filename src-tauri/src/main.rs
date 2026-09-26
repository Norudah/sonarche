#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod artist_images;
mod artwork;
mod audio_formats;
mod commands;
mod convert;
mod download_undo;
mod error;
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

#[allow(
    clippy::expect_used,
    reason = "startup: no app to report to without it"
)]
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
            commands::setup::get_env_status,
            commands::setup::setup_env,
            commands::setup::reveal_log_file,
            commands::setup::check_acoustid_key,
            commands::setup::check_services,
            commands::setup::get_onboarding_state,
            commands::setup::set_onboarding_completed,
            commands::downloads::enqueue_download,
            commands::downloads::list_jobs,
            commands::downloads::list_jobs_page,
            commands::downloads::download_target_albums,
            commands::downloads::retry_job,
            commands::downloads::cancel_job,
            commands::downloads::clear_job_history,
            commands::downloads::preview_download_undo,
            commands::downloads::undo_download,
            commands::downloads::change_job_destination,
            commands::library::list_library,
            commands::library::playable_extensions,
            commands::library::reenrich_track,
            commands::maintenance::remux_library,
            commands::preferences::set_audio_format,
            commands::maintenance::convert_library,
            commands::library::fetch_lyrics,
            commands::organize::library_align_scan,
            commands::organize::library_align_apply,
            commands::preferences::get_preferences,
            commands::preferences::set_rate_limit_delay,
            commands::preferences::get_home_tour_seen,
            commands::preferences::set_home_tour_seen,
            commands::maintenance::get_library_location,
            commands::maintenance::check_library_move,
            commands::maintenance::move_library,
            commands::library::delete_track,
            commands::library::update_tracks,
            commands::organize::move_tracks,
            commands::organize::set_album_kind,
            commands::organize::set_genre_family,
            commands::organize::list_genre_overrides,
            commands::organize::set_check_accepted,
            commands::covers::allow_cover_preview,
            commands::covers::album_recrop_source,
            commands::covers::set_album_cover,
            commands::covers::list_cover_candidates,
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
            commands::imports::scan_import_folder,
            commands::imports::start_library_import,
            commands::imports::cancel_library_import,
            commands::imports::list_imports,
            commands::imports::preview_import_undo,
            commands::imports::undo_import,
            commands::preferences::list_api_keys,
            commands::preferences::reveal_api_key,
            commands::preferences::set_api_key,
            commands::maintenance::erase_all_data,
            commands::maintenance::erase_library,
            commands::maintenance::erase_artist_images,
            commands::maintenance::erase_playlists,
            commands::maintenance::reinstall_environment,
            commands::maintenance::reset_setup_dev,
            commands::maintenance::reset_library_dev,
            commands::player::player_load,
            commands::player::player_enqueue,
            commands::player::player_toggle,
            commands::player::player_seek,
            commands::player::player_set_volume,
            commands::player::player_stop,
            commands::player::now_playing_set,
            commands::preferences::set_window_theme,
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
