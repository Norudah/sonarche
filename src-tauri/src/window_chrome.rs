//! Making the native window frame as quiet as each OS allows, and keeping it on
//! the same theme as the app inside it.
//!
//! macOS needs no help with the frame itself: `titleBarStyle: "Overlay"` already
//! hands the app the whole window, and the front end paints its own top-left
//! corner. It does need `set_theme`, which is what turns the traffic lights,
//! the native scrollbars and the system menus dark alongside the webview.
//!
//! Windows keeps its caption bar above us and there is no config key for it, so
//! what is left is the two things DWM will let a process change about its own
//! window: the title text and the bar's colour. Both are done here rather than
//! left as they came — a grey strip reading "Sonarche" over an app whose whole
//! chrome is near-white is the one seam a user sees before anything else.

use serde::Deserialize;
use tauri::window::Color;
use tauri::{AppHandle, Manager, Theme, WebviewWindow};

/// `--background` from app/theme.css, one per theme, as the window's own
/// colour.
///
/// The webview has nothing to draw until the document loads, and what shows
/// through until then is this — white by default, which on Night is a
/// full-window flash at every launch. `index.html` paints the same two values
/// inline for the frame after that, and the stylesheet takes over from there:
/// three layers, one colour, no seam.
const PAPER: Color = Color(248, 249, 253, 255);
const NIGHT: Color = Color(15, 16, 24, 255);

/// The Appearance choice, as the window hears it.
///
/// `System` has to reach `set_theme` as `None` and not as an already-resolved
/// Light or Dark. A window pinned to a theme reports that theme to its own
/// webview, so `prefers-color-scheme` inside would answer with our own setting
/// rather than the desktop's — and "follow the system" would latch onto
/// whichever theme it happened to be wearing when the choice was made.
///
/// Deserialising into this enum is the validation: anything that is not one of
/// the three strings fails at the IPC boundary instead of reaching a window
/// call.
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

/// Startup: strip the caption text and paint the frame for whatever theme the
/// window came up in. The front end sends the real choice a moment later, once
/// it has read the stored preference.
pub fn quieten(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        strip_title(&window);
        paint(&window, resolved(&window));
    }
}

/// The Appearance setting reaching the frame. Every path in — the user picking,
/// the desktop flipping under a `System` choice — lands here.
pub fn follow(window: &WebviewWindow, choice: ThemeChoice) {
    // Deliberately dropped: a window that refuses a theme is still a usable
    // window, and there is no one to report it to.
    let _ = window.set_theme(choice.into());
    paint(window, resolved(window));
}

/// What the window is actually wearing now — the forced theme under an explicit
/// choice, the desktop's own under `System`.
fn resolved(window: &WebviewWindow) -> Theme {
    window.theme().unwrap_or(Theme::Light)
}

/// Everything the frame wears in this theme: the surface behind the webview
/// everywhere, and the caption bar on Windows.
fn paint(window: &WebviewWindow, theme: Theme) {
    let colour = match theme {
        Theme::Dark => NIGHT,
        _ => PAPER,
    };
    // Dropped like `set_theme` above: a window that will not take a background
    // colour is still a usable window, and the cost of the refusal is the white
    // frame we had before.
    let _ = window.set_background_color(Some(colour));
    paint_caption(window, theme);
}

#[cfg(target_os = "windows")]
fn strip_title(window: &WebviewWindow) {
    // An empty title is the only way to take the app's name off a native caption
    // bar. Nothing else loses it: the taskbar names the app from the executable,
    // and the window already says what it is on every one of its own pages.
    let _ = window.set_title("");
}

#[cfg(not(target_os = "windows"))]
fn strip_title(_window: &WebviewWindow) {}

#[cfg(target_os = "windows")]
fn paint_caption(window: &WebviewWindow, theme: Theme) {
    use std::ffi::c_void;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
    };

    // Derived from the same two constants the webview background uses, rather
    // than written out again: DWM wants a COLORREF, which is `0x00BBGGRR` and
    // not RGB, and a hand-swapped hex literal is a byte-order bug waiting for
    // the next palette change.
    let Color(r, g, b, _) = match theme {
        Theme::Dark => NIGHT,
        _ => PAPER,
    };
    let colour = (b as u32) << 16 | (g as u32) << 8 | r as u32;

    let Ok(handle) = window.hwnd() else { return };
    // `HWND` is a newtype over the raw pointer; going through it keeps this
    // independent of which `windows` version tao happens to pull in.
    let hwnd = handle.0 as *mut c_void;
    let value = &colour as *const u32 as *const c_void;
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
fn paint_caption(_window: &WebviewWindow, _theme: Theme) {}
