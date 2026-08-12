/**
 * The guided tour's two tiny cross-feature facts, and nothing of its UI.
 *
 * In `shared` because the tour itself is shell furniture (the app layer mounts
 * it) while the button that replays it belongs to Settings — and features may
 * not import the app or each other. Both sides meet here: Settings raises the
 * request, the shell listens.
 */

const STORAGE_KEY = "sonarche.homeTourSeen";

/** Whether the tour has already had its one spontaneous showing. A storage
 * that cannot be read counts as seen: better no tour than one on every launch. */
export function homeTourSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    return true;
  }
}

export function markHomeTourSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    // Nothing to do: the tour still closes for this session.
  }
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
