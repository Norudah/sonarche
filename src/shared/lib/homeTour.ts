/**
 * The guided tour's two tiny cross-feature facts, and nothing of its UI.
 *
 * In `shared` because the tour itself is shell furniture (the app layer mounts
 * it) while the button that replays it belongs to Settings — and features may
 * not import the app or each other. Both sides meet here: Settings raises the
 * request, the shell listens.
 */

import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "sonarche.homeTourSeen";

/**
 * Whether the tour has already had its one spontaneous showing.
 *
 * The truth lives on disk (`preferences.json`): up to 2.0.0 it sat in
 * localStorage, but an ad-hoc-signed bundle is not guaranteed to keep its
 * WebKit data store across updates, so every release replayed the tour. A
 * surviving localStorage flag is promoted to disk here, then ignored. A store
 * that cannot be read counts as seen: better no tour than one on every launch.
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
  // localStorage stays as a same-session belt to the disk's braces: if the
  // write below fails, the tour still stays closed until the next launch.
  try {
    window.localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // Nothing to do: the tour still closes for this session.
  }
  void invoke("set_home_tour_seen", { seen: true }).catch(() => undefined);
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Ask the shell to run the tour now — the Settings "replay" button. */
export function requestHomeTour(): void {
  for (const listener of listeners) listener();
}

export function onHomeTourRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
