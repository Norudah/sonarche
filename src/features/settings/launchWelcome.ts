/** Whether the splash shows a welcome beat. In localStorage (read before the
 * preferences load). On by default; only the words are skipped, not the fade. */

const STORAGE_KEY = "sonarche.launchWelcome";

/** Unreadable or unset means on. */
export function parseLaunchWelcome(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readLaunchWelcome(): boolean {
  try {
    return parseLaunchWelcome(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can throw in a hardened webview.
    return true;
  }
}

export function storeLaunchWelcome(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable: the choice holds for this session.
  }
}
