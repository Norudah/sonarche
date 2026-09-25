/** Whether re-match asks for confirmation before rewriting tags. Same store
 * shape as `notificationBadges`. */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sonarche.rematchConfirm";

const listeners = new Set<() => void>();

/** Unreadable or unset means ask. */
export function parseRematchConfirm(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readRematchConfirm(): boolean {
  try {
    return parseRematchConfirm(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can throw in a hardened webview.
    return true;
  }
}

export function storeRematchConfirm(enabled: boolean): void {
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

export function useRematchConfirm(): boolean {
  return useSyncExternalStore(subscribe, readRematchConfirm, () => true);
}
