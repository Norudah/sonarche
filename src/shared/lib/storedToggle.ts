/**
 * An on/off preference in localStorage, on by default. localStorage so the
 * shell can read it synchronously (before the preferences load);
 * `useStoredToggle` updates every surface live.
 */

import { useSyncExternalStore } from "react";

/** Only the exact stored word switches it off: unset, unreadable or unknown
 * (an older build, a hand edit) means on. */
export function parseToggle(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export interface StoredToggle {
  read: () => boolean;
  store: (enabled: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

export function storedToggle(key: string): StoredToggle {
  const listeners = new Set<() => void>();
  return {
    read: () => {
      try {
        return parseToggle(window.localStorage.getItem(key));
      } catch {
        // Storage can throw in a hardened webview.
        return true;
      }
    },
    store: (enabled) => {
      try {
        window.localStorage.setItem(key, enabled ? "on" : "off");
      } catch {
        // Storage unavailable: the choice holds for this session.
      }
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStoredToggle(toggle: StoredToggle): boolean {
  return useSyncExternalStore(toggle.subscribe, toggle.read, () => true);
}
