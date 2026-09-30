/** The composer's last category, remembered in localStorage (a convenience,
 * not a setting). `null` (no category) is stored distinctly from unset. */

const KEY = "sonarche.download.category";
const DEFAULT_CATEGORY = "Music";
/** Stored value for an explicit "no category". */
const NONE = "";

export function readLastCategory(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return DEFAULT_CATEGORY;
    return stored === NONE ? null : stored;
  } catch {
    // Storage may be unavailable; fall back silently.
    return DEFAULT_CATEGORY;
  }
}

export function writeLastCategory(category: string | null): void {
  try {
    window.localStorage.setItem(KEY, category ?? NONE);
  } catch {
    // Storage unavailable: the choice is simply not remembered.
  }
}
