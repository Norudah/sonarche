/**
 * Settings dialog state (open, category). In `shared` because the update
 * toast opens it too. Module state, since the openers live in unrelated
 * parts of the tree.
 */

import { useSyncExternalStore } from "react";

/** Labels, icons and order live in the settings feature's `categories.ts`. */
export type SettingsCategoryId =
  "appearance" | "adding" | "metadata" | "files" | "services" | "updates" | "advanced" | "danger" | "developer";

export interface SettingsDialogState {
  isOpen: boolean;
  /** Kept while closed, so reopening lands where the user left. */
  category: SettingsCategoryId;
  /** A setting requested by search (i18n base key): the pane scrolls to it,
   * highlights it once, then clears this. */
  highlight: string | null;
}

let state: SettingsDialogState = { isOpen: false, category: "appearance", highlight: null };

const listeners = new Set<() => void>();

function set(next: SettingsDialogState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Without a category, reopens on the last one. */
export function openSettings(category?: SettingsCategoryId): void {
  set({ ...state, isOpen: true, category: category ?? state.category });
}

export function closeSettings(): void {
  if (state.isOpen) set({ ...state, isOpen: false });
}

export function selectSettingsCategory(category: SettingsCategoryId): void {
  set({ ...state, category, highlight: null });
}

export function revealSetting(category: SettingsCategoryId, key: string): void {
  set({ isOpen: true, category, highlight: key });
}

export function clearSettingsHighlight(): void {
  if (state.highlight !== null) set({ ...state, highlight: null });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): SettingsDialogState {
  return state;
}

export function useSettingsDialog(): SettingsDialogState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
