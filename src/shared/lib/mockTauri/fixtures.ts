/** Shared fixture helpers and URL switches. */

/** Dev-only Tauri IPC stub so the UI can be previewed in a plain browser
 * (`vite dev` + `?mockTauri`). Never bundled in production builds. */

export const now = Date.now();

/** 16:9 like a real video thumbnail. */
export function thumb(from: string, to: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** `?empty`: every listing is empty (first launch). */
export const isEmpty = new URLSearchParams(window.location.search).has("empty");
