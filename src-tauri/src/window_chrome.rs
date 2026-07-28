//! Making the native window frame as quiet as each OS allows.
//!
//! macOS has nothing to do here: `titleBarStyle: "Overlay"` already hands the
//! app the whole window, and the front end paints its own top-left corner.
//!
//! Windows keeps its caption bar above us and there is no config key for it, so
//! what is left is the two things DWM will let a process change about its own
//! window: the title text and the bar's colour. Both are done here rather than
//! left as they came — a grey strip reading "Sonarche" over an app whose whole
//! chrome is near-white is the one seam a user sees before anything else.

use tauri::{AppHandle, Manager};

pub fn quieten(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        apply(&window);
    }
}

#[cfg(target_os = "windows")]
fn apply(window: &tauri::WebviewWindow) {
    use std::ffi::c_void;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
    };

    /// The app background (`--background`, oklch(0.995 0.0012 75) = rgb 254 253
    /// 252) as a COLORREF, which is `0x00BBGGRR` and not RGB. Light only, like
    /// the rest of the app for now; it follows the theme the day there is one.
    const CHROME: u32 = 0x00FC_FD_FE;

    // An empty title is the only way to take the app's name off a native caption
    // bar. Nothing else loses it: the taskbar names the app from the executable,
    // and the window already says what it is on every one of its own pages.
    let _ = window.set_title("");

    let Ok(handle) = window.hwnd() else { return };
    // `HWND` is a newtype over the raw pointer; going through it keeps this
    // independent of which `windows` version tao happens to pull in.
    let hwnd = handle.0 as *mut c_void;
    let value = &CHROME as *const u32 as *const c_void;
    let size = std::mem::size_of::<u32>() as u32;

    // The constants are `i32` and the parameter is `u32`; the cast is the whole
    // of the mismatch.
    for attribute in [DWMWA_CAPTION_COLOR as u32, DWMWA_BORDER_COLOR as u32] {
        // SAFETY: `hwnd` is this window's live handle, and `value` points at a
        // `u32` that outlives the call — the two things DwmSetWindowAttribute
        // requires. The result is deliberately dropped: these attributes only
        // exist on Windows 11 (build 22000+), and on 10 the call answers
        // E_INVALIDARG and leaves the bar as it was, which is not a failure
        // worth reporting to anyone.
        unsafe {
            DwmSetWindowAttribute(hwnd, attribute, value, size);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn apply(_window: &tauri::WebviewWindow) {}
