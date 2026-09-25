//! Native window frame theming.
//!
//! macOS: `titleBarStyle: "Overlay"` already hands the app the whole window;
//! `set_theme` darkens the traffic lights, scrollbars and menus.
//! Windows: the caption bar can't be removed, so DWM paints it in the app's
//! background colour. The title text stays for the taskbar and Alt-Tab.

use serde::Deserialize;
use tauri::window::Color;
use tauri::{AppHandle, Manager, Theme, WebviewWindow};

/// `--background` from app/theme.css per theme, painted behind the webview
/// so dark mode doesn't flash white before the document loads.
const PAPER: Color = Color(248, 249, 253, 255);
const NIGHT: Color = Color(15, 16, 24, 255);

/// The Appearance choice. `System` maps to `None`: a window pinned to a
/// theme would report it to `prefers-color-scheme`, breaking "follow system".
/// Deserializing validates the IPC input.
#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ThemeChoice {
    Light,
    Dark,
    System,
}

impl From<ThemeChoice> for Option<Theme> {
    fn from(choice: ThemeChoice) -> Self {
        match choice {
            ThemeChoice::Light => Some(Theme::Light),
            ThemeChoice::Dark => Some(Theme::Dark),
            ThemeChoice::System => None,
        }
    }
}

/// Paints the frame at startup; the front sends the stored choice shortly after.
pub fn quieten(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        paint(&window, resolved(&window));
    }
}

pub fn follow(window: &WebviewWindow, choice: ThemeChoice) {
    // A window refusing a theme is still usable.
    let _ = window.set_theme(choice.into());
    paint(window, resolved(window));
}

/// The theme the window currently shows.
fn resolved(window: &WebviewWindow) -> Theme {
    window.theme().unwrap_or(Theme::Light)
}

fn paint(window: &WebviewWindow, theme: Theme) {
    let colour = match theme {
        Theme::Dark => NIGHT,
        _ => PAPER,
    };
    // Non-fatal, like `set_theme`.
    let _ = window.set_background_color(Some(colour));
    paint_caption(window, theme);
}

#[cfg(target_os = "windows")]
fn paint_caption(window: &WebviewWindow, theme: Theme) {
    use std::ffi::c_void;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
    };

    // COLORREF is `0x00BBGGRR`, derived from the same constants as the webview.
    let Color(r, g, b, _) = match theme {
        Theme::Dark => NIGHT,
        _ => PAPER,
    };
    let colour = (b as u32) << 16 | (g as u32) << 8 | r as u32;

    let Ok(handle) = window.hwnd() else { return };
    // Via the newtype, independent of tao's `windows` version.
    let hwnd = handle.0 as *mut c_void;
    let value = &colour as *const u32 as *const c_void;
    let size = std::mem::size_of::<u32>() as u32;

    for attribute in [DWMWA_CAPTION_COLOR as u32, DWMWA_BORDER_COLOR as u32] {
        // SAFETY: `hwnd` is this window's live handle and `value` outlives the call.
        // Errors are ignored: these attributes exist only on Windows 11.
        unsafe {
            DwmSetWindowAttribute(hwnd, attribute, value, size);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn paint_caption(_window: &WebviewWindow, _theme: Theme) {}
