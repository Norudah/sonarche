/**
 * Whether the sidebar shows notification badges (the Metadata to-fix count).
 * On by default. In localStorage so the shell can read it synchronously, and
 * exposed through `useSyncExternalStore` so every surface updates live.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sonarche.notificationBadges";

const listeners = new Set<() => void>();

/** Unreadable or unset means on. */
export function parseNotificationBadges(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readNotificationBadges(): boolean {
  try {
    return parseNotificationBadges(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can throw in a hardened webview.
    return true;
  }
}

export function storeNotificationBadges(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable: the choice holds for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotificationBadges(): boolean {
  return useSyncExternalStore(subscribe, readNotificationBadges, () => true);
}
