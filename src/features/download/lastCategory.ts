/**
 * The category the composer was last set to, remembered across sessions.
 *
 * Someone filing a shelf of game soundtracks picks "Video Games" once and then
 * pastes twenty links; re-choosing it every time is the kind of friction that
 * makes an option not worth having. Kept in the webview's own storage rather
 * than in `preferences.json`: it is a memory of the last click, not a setting
 * the user manages, and it has no business crossing the IPC boundary.
 *
 * `null` is a real stored value — "file nothing under any category" — which is
 * why the absent key and an explicit none are distinguished.
 */

const KEY = "sonarche.download.category";
/** What a first-ever launch starts on: the ordinary case for a music app. */
const DEFAULT_CATEGORY = "Music";
/** Sentinel for a deliberate "no category", since storage holds strings only. */
const NONE = "";

export function readLastCategory(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return DEFAULT_CATEGORY;
    return stored === NONE ? null : stored;
  } catch {
    // Storage can be unavailable (private mode, a locked-down webview). A
    // remembered choice is a convenience; losing it must not break the form.
    return DEFAULT_CATEGORY;
  }
}

export function writeLastCategory(category: string | null): void {
  try {
    window.localStorage.setItem(KEY, category ?? NONE);
  } catch {
    // See above: nothing to recover, and nothing worth telling the user.
  }
}
