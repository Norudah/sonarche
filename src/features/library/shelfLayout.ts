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
 * One key per shelf rather than one for both. The two are read at different
 * distances — a wall of covers is how you recognise a record you own, a list is
 * how you find one by name — and nothing says the answer is the same for
 * artists, whose grid is portraits rather than artwork.
 */

export const SHELF_LAYOUTS = ["grid", "list"] as const;
export type ShelfLayout = (typeof SHELF_LAYOUTS)[number];

export type Shelf = "albums" | "artists";

const STORAGE_KEYS: Record<Shelf, string> = {
  albums: "sonarche.shelfLayout.albums",
  artists: "sonarche.shelfLayout.artists",
};

/** Anything unreadable means nobody has chosen, and the grid is the shelf the
 * app was designed around. */
export function parseShelfLayout(raw: string | null | undefined): ShelfLayout {
  return raw === "list" ? "list" : "grid";
}

function read(shelf: Shelf): ShelfLayout {
  try {
    return parseShelfLayout(window.localStorage.getItem(STORAGE_KEYS[shelf]));
  } catch {
    // Storage throws rather than returning null in a hardened webview.
    return "grid";
  }
}

/**
 * The remembered layout and the way to change it.
 *
 * Plain state over a `useSyncExternalStore` — unlike the option panels, which
 * are flipped in Settings and read on another page: this switch sits on the
 * very shelf it governs, so there is no second reader to keep in step.
 */
export function useShelfLayout(shelf: Shelf): [ShelfLayout, (layout: ShelfLayout) => void] {
  const [layout, setLayout] = useState<ShelfLayout>(() => read(shelf));

  return [
    layout,
    (next: ShelfLayout) => {
      setLayout(next);
      try {
        window.localStorage.setItem(STORAGE_KEYS[shelf], next);
      } catch {
        // Nothing to do: the choice still holds for this session.
      }
    },
  ];
}
