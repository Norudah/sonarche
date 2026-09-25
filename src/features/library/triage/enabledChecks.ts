/**
 * Checks the user wants raised. Disabling a check (unlike accepting objects,
 * see `accepted.py`) removes its line and badge count but keeps computing it.
 * In localStorage with the `useSyncExternalStore` pattern.
 */

import { useSyncExternalStore } from "react";

import type { TriageLine } from "@/features/library/triage/queue";

export type CheckKey = TriageLine["key"];

/** In queue order; the artist-image check last. */
export const CHECK_KEYS: CheckKey[] = [
  "suspect",
  "duplicates",
  "year",
  "track",
  "genre",
  "artwork",
  "tracklist",
  "artistImage",
];

const STORAGE_KEY = "sonarche.disabledChecks";

const listeners = new Set<() => void>();

/** Unknown keys (older builds) are dropped. */
export function parseDisabled(raw: string | null | undefined): CheckKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is CheckKey => (CHECK_KEYS as string[]).includes(part));
}

function read(): CheckKey[] {
  try {
    return parseDisabled(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can throw in a hardened webview.
    return [];
  }
}

/** Stable between writes, or `useSyncExternalStore` re-renders forever. */
let snapshot: CheckKey[] = [];
let snapshotKey: string | null = null;

function currentSnapshot(): CheckKey[] {
  const disabled = read();
  const key = disabled.join(",");
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = disabled;
  }
  return snapshot;
}

export function setCheckEnabled(check: CheckKey, enabled: boolean): void {
  const next = enabled ? read().filter((key) => key !== check) : Array.from(new Set([...read(), check]));
  try {
    window.localStorage.setItem(STORAGE_KEY, next.join(","));
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

export function useDisabledChecks(): CheckKey[] {
  return useSyncExternalStore(subscribe, currentSnapshot, () => snapshot);
}

/** Disabled lines leave the queue but keep their count for the menu. */
export function enabledLines(queue: TriageLine[], disabled: CheckKey[]): TriageLine[] {
  return disabled.length === 0 ? queue : queue.filter((line) => !disabled.includes(line.key));
}
