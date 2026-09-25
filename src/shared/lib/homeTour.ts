/** Tour state shared by the shell (which runs it) and Settings (which replays it). */

import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "sonarche.homeTourSeen";

/**
 * Whether the tour was already shown. Stored in `preferences.json`, since an
 * ad-hoc-signed bundle may lose localStorage across updates; a legacy
 * localStorage flag is migrated. Unreadable counts as seen.
 */
export async function homeTourSeen(): Promise<boolean> {
  try {
    if (await invoke<boolean>("get_home_tour_seen")) return true;
    if (window.localStorage.getItem(STORAGE_KEY) === "yes") {
      void invoke("set_home_tour_seen", { seen: true }).catch(() => undefined);
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function markHomeTourSeen(): void {
  // Session fallback in case the disk write fails.
  try {
    window.localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // Storage unavailable: the tour stays closed for this session.
  }
  void invoke("set_home_tour_seen", { seen: true }).catch(() => undefined);
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Used by the Settings "replay" button. */
export function requestHomeTour(): void {
  for (const listener of listeners) listener();
}

export function onHomeTourRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
