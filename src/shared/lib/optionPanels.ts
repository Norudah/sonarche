/**
 * Whether the download and import option panels open by themselves. On by
 * default (so new users discover the options), switchable per panel. Same
 * localStorage + `useSyncExternalStore` store as `notificationBadges`.
 */

import { useSyncExternalStore } from "react";

type OptionPanel = "download" | "import";

const STORAGE_KEYS: Record<OptionPanel, string> = {
  download: "sonarche.autoExpand.download",
  import: "sonarche.autoExpand.import",
};

const listeners = new Set<() => void>();

/** Unreadable or unset means open. */
export function parseAutoExpand(raw: string | null | undefined): boolean {
  return raw !== "off";
}

function readAutoExpand(panel: OptionPanel): boolean {
  try {
    return parseAutoExpand(window.localStorage.getItem(STORAGE_KEYS[panel]));
  } catch {
    // Storage can throw in a hardened webview.
    return true;
  }
}

export function storeAutoExpand(panel: OptionPanel, enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS[panel], enabled ? "on" : "off");
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

export function useAutoExpand(panel: OptionPanel): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readAutoExpand(panel),
    () => true,
  );
}
