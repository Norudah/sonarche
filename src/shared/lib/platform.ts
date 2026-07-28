/**
 * Which desktop the app is running on, read once from the webview's own user
 * agent because the answer cannot change while the app is running.
 *
 * `@tauri-apps/plugin-os` gives the same string over IPC and asynchronously — a
 * whole round trip, and a first paint with the wrong chrome, to learn what the
 * UA already says.
 */
export const isMacOS = navigator.userAgent.includes("Mac OS X");
