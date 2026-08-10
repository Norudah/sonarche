/**
 * Which checks this person wants Sonarche to raise at all.
 *
 * Accepting answers *these* objects (see `accepted.py`); turning a check off
 * answers the question itself. Somebody who does not file music by release year
 * should not have to re-answer the year line after every import, and the app
 * insisting is the difference between a tool and a nag.
 *
 * Nothing is deleted and nothing stops being computed: a disabled check keeps
 * its count, which the menu shows next to its switch. It simply stops being
 * queued and stops being counted — the line leaves the page, and the badge with
 * it.
 *
 * localStorage rather than the library, and rather than the sidecar's
 * preferences: this is a reading preference of one person on one machine, not a
 * fact about the music, and the shell needs it before anything has been asked
 * of the sidecar. Same `useSyncExternalStore` shape as the notification badge,
 * so the page and the sidebar can never disagree about what is on.
 */

import { useSyncExternalStore } from "react";

import type { TriageLine } from "@/features/library/triage/queue";

export type CheckKey = TriageLine["key"];

/** Every check, in the order the queue lists them. */
export const CHECK_KEYS: CheckKey[] = ["suspect", "duplicates", "year", "genre", "artwork", "tracklist"];

const STORAGE_KEY = "sonarche.disabledChecks";

const listeners = new Set<() => void>();

/** The stored list, ignoring anything that is not a check we know — a key from
 * an older build must not survive as a permanently silent line. */
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
    // Storage throws rather than returning null in a hardened webview.
    return [];
  }
}

/** Cached so `useSyncExternalStore` gets a stable reference between writes —
 * `read()` builds a new array every call, which the store reads as a change and
 * re-renders on forever. */
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
    // Nothing to do: the notify below still holds the choice for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live preference — re-renders the caller the moment a switch flips. */
export function useDisabledChecks(): CheckKey[] {
  return useSyncExternalStore(subscribe, currentSnapshot, () => snapshot);
}

/** The queue as the page should show it. A disabled line keeps its count for
 * the menu to display; it just is not part of the queue any more. */
export function enabledLines(queue: TriageLine[], disabled: CheckKey[]): TriageLine[] {
  return disabled.length === 0 ? queue : queue.filter((line) => !disabled.includes(line.key));
}
