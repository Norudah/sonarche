import { useState } from "react";

/**
 * Whether a shelf shows covers or rows.
 *
 * A display preference, so it lives in localStorage and not in the URL. The
 * view-mode switch on a detail page *is* in the URL because the two faces of an
 * artist are two different things to look at, and which one you are looking at
 * is part of where you are. This is not that: the albums page shows the same
 * albums either way. Someone who prefers rows prefers them tomorrow too, and a
 * choice that had to be made again on every visit would not be a preference.
 *
 * One key for every shelf, not one per shelf. The switch is the same control in
 * the same corner of two pages that are browsed one after the other; setting it
 * on the albums page and finding the artists page still in covers reads as the
 * switch having failed, not as two preferences being kept. "I read my library
 * as a list" is one statement about the person, not one per shelf.
 */

export const SHELF_LAYOUTS = ["grid", "list"] as const;
export type ShelfLayout = (typeof SHELF_LAYOUTS)[number];

const STORAGE_KEY = "sonarche.shelfLayout";

/** Anything unreadable means nobody has chosen, and the grid is the shelf the
 * app was designed around. */
export function parseShelfLayout(raw: string | null | undefined): ShelfLayout {
  return raw === "list" ? "list" : "grid";
}

function read(): ShelfLayout {
  try {
    return parseShelfLayout(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return "grid";
  }
}

/**
 * The remembered layout and the way to change it.
 *
 * Plain state over a `useSyncExternalStore`: the two shelves sharing the key
 * are two routes, never on screen at once, so each one reads the stored choice
 * when it mounts and there is no live reader to keep in step.
 */
export function useShelfLayout(): [ShelfLayout, (layout: ShelfLayout) => void] {
  const [layout, setLayout] = useState<ShelfLayout>(read);

  return [
    layout,
    (next: ShelfLayout) => {
      setLayout(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Nothing to do: the choice still holds for this session.
      }
    },
  ];
}
