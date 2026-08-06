/**
 * Whether the sidebar wears notification badges (today: the to-fix count on
 * the Metadata tab).
 *
 * Stored beside `theme.ts` and `launchWelcome.ts` for the same reason: the
 * answer is needed by the shell, before anything asks the sidecar for the
 * preferences it keeps on disk.
 *
 * On by default — the badge is the page's reason to be visited. Unlike the
 * welcome word, this one is read *live*: the sidebar must drop its badge the
 * moment the switch flips, so the module keeps a subscriber list and exposes
 * the value through `useSyncExternalStore`.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sonarche.notificationBadges";

const listeners = new Set<() => void>();

/** Anything unreadable means nobody has chosen, and nobody choosing means on. */
export function parseNotificationBadges(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readNotificationBadges(): boolean {
  try {
    return parseNotificationBadges(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return true;
  }
}

export function storeNotificationBadges(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
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
export function useNotificationBadges(): boolean {
  return useSyncExternalStore(subscribe, readNotificationBadges, () => true);
}
