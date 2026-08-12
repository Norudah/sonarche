/**
 * Whether the two "what will this do" panels open themselves.
 *
 * The download composer unfolds its options the moment a link is recognised,
 * and the import card unfolds its own the moment a folder is scanned — both on
 * the same argument: options only a chevron ever surfaced were options nobody
 * knew existed. That argument is about the *first* dozen links, not the
 * thousandth: someone who has answered the same two questions a hundred times
 * is being handed a panel they have already decided about, every single time.
 *
 * So it stays on by default and can be turned off, per panel, because the two
 * pages are not used with the same rhythm — a download is a reflex, an import
 * is an event.
 *
 * In `shared` rather than in either feature: the two features may not import
 * each other, and Settings lists both. localStorage for the same reason as
 * `notificationBadges` — the answer is needed while the page renders, not after
 * a round-trip to the sidecar's preferences file. Read live through
 * `useSyncExternalStore`, so flipping a switch in Settings is already true on
 * the page it governs.
 */

import { useSyncExternalStore } from "react";

export type OptionPanel = "download" | "import";

const STORAGE_KEYS: Record<OptionPanel, string> = {
  download: "sonarche.autoExpand.download",
  import: "sonarche.autoExpand.import",
};

const listeners = new Set<() => void>();

/** Anything unreadable means nobody has chosen, and nobody choosing means the
 * panel opens itself. */
export function parseAutoExpand(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readAutoExpand(panel: OptionPanel): boolean {
  try {
    return parseAutoExpand(window.localStorage.getItem(STORAGE_KEYS[panel]));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return true;
  }
}

export function storeAutoExpand(panel: OptionPanel, enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS[panel], enabled ? "on" : "off");
  } catch {
    // Nothing to do: the choice still holds for this session via the notify.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live preference — re-renders the caller when the switch flips. */
export function useAutoExpand(panel: OptionPanel): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readAutoExpand(panel),
    () => true,
  );
}
