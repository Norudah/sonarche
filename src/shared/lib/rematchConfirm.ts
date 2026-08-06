/**
 * Whether re-match asks for confirmation before rewriting tags.
 *
 * In `shared` because two features genuinely consume it: the library's rematch
 * surfaces read it before firing, and the settings page edits it. Same
 * localStorage + `useSyncExternalStore` shape as the notification badges —
 * the "don't ask again" switch inside the dialog must flip the settings page
 * live, and vice versa.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sonarche.rematchConfirm";

const listeners = new Set<() => void>();

/** Anything unreadable means nobody has chosen, and nobody choosing means the
 * dialog shows — a destructive rewrite should never turn silent by accident. */
export function parseRematchConfirm(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readRematchConfirm(): boolean {
  try {
    return parseRematchConfirm(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return true;
  }
}

export function storeRematchConfirm(enabled: boolean): void {
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
export function useRematchConfirm(): boolean {
  return useSyncExternalStore(subscribe, readRematchConfirm, () => true);
}
