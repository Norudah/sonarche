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
}

let state: SettingsDialogState = { isOpen: false, category: "appearance" };

const listeners = new Set<() => void>();

function set(next: SettingsDialogState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Open Settings, optionally on a named category. Omitting it reopens
 * wherever the user was last — the app has no opinion about where they
 * belong, only about where they were. */
export function openSettings(category?: SettingsCategoryId): void {
  set({ isOpen: true, category: category ?? state.category });
}

export function closeSettings(): void {
  if (state.isOpen) set({ ...state, isOpen: false });
}

export function selectSettingsCategory(category: SettingsCategoryId): void {
  set({ ...state, category });
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
