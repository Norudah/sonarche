/**
 * Whether the app says hello before it opens.
 *
 * Beside `theme.ts` and `language.ts` and stored the same way, for a related
 * reason: the answer is needed at the very start of a session, before anything
 * has had a chance to ask the sidecar for the preferences it keeps on disk.
 *
 * On by default. The welcome is a second of the app's own voice at the end of a
 * wait it did not choose to have — worth showing to someone who has never seen
 * it, and worth being able to switch off by someone who has seen it four
 * hundred times.
 *
 * This governs the *words*, not the hand-over. Turning it off skips the beat;
 * the cross-fade that replaces the splash with the app stays either way,
 * because the thing it fixed was a hard cut, and a hard cut is not a preference.
 */

const STORAGE_KEY = "sonarche.launchWelcome";

/** Anything unreadable means nobody has chosen, and nobody choosing means on. */
export function parseLaunchWelcome(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readLaunchWelcome(): boolean {
  try {
    return parseLaunchWelcome(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return true;
  }
}

export function storeLaunchWelcome(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Nothing to do: the choice still holds for this session.
  }
}
