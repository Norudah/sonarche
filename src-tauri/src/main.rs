#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod jobs;
mod python_env;
mod reenrich;
mod settings;
mod sidecar;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(sidecar::SidecarState::default())
        .manage(reenrich::ReenrichState::default())
        .setup(|app| {
            let state = jobs::init(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_status,
            commands::setup_env,
            commands::enqueue_download,
            commands::list_jobs,
            commands::retry_job,
            commands::clear_job_history,
            commands::list_library,
            commands::reenrich_track,
            commands::delete_track,
            commands::list_api_keys,
            commands::set_api_key,
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
