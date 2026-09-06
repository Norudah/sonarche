/**
 * Whether Settings is open, and on which category.
 *
 * Settings used to be a route that swapped the sidebar's whole nav for a
 * category menu — a mode, with the entry and the exit sharing one morphing
 * button and a ref remembering where to return. It is a modal now: a detour
 * you take while the app stays where it was, with three ways out and nothing
 * to remember.
 *
 * In `shared` rather than in the settings feature because the update toast
 * opens it (`features/update`), and features do not import each other. Same
 * arrangement as `homeTour`, for the same reason.
 *
 * Module state and not React state: the store outlives any one component, and
 * the two openers sit on opposite sides of the tree.
 */

import { useSyncExternalStore } from "react";

/** The panes the dialog can show. `categories.ts` in the settings feature is
 * what gives them a label, an icon and an order; this module only needs to
 * name one. */
export type SettingsCategoryId =
  "appearance" | "adding" | "metadata" | "files" | "services" | "updates" | "advanced" | "danger" | "developer";

export interface SettingsDialogState {
  isOpen: boolean;
  /** Kept while closed, so reopening lands where you left. */
  category: SettingsCategoryId;
  /** The setting a search result asked for, by its i18n base key. The pane
   * scrolls it into view and rings it once, then clears this — landing on the
   * right pane and still having to hunt is most of the way to no search at
   * all. */
  highlight: string | null;
}

let state: SettingsDialogState = { isOpen: false, category: "appearance", highlight: null };

const listeners = new Set<() => void>();

function set(next: SettingsDialogState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Open Settings, optionally on a named category. Omitting it reopens
 * wherever the user was last — the app has no opinion about where they
 * belong, only about where they were. */
export function openSettings(category?: SettingsCategoryId): void {
  set({ ...state, isOpen: true, category: category ?? state.category });
}

export function closeSettings(): void {
  if (state.isOpen) set({ ...state, isOpen: false });
}

export function selectSettingsCategory(category: SettingsCategoryId): void {
  set({ ...state, category, highlight: null });
}

/** Jump to a setting: its pane, then the setting itself. */
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
