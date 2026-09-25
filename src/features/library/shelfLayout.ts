import { useState } from "react";

/** Grid or list, in localStorage: a personal display preference, one key for
 * every shelf. */

export const SHELF_LAYOUTS = ["grid", "list"] as const;
export type ShelfLayout = (typeof SHELF_LAYOUTS)[number];

const STORAGE_KEY = "sonarche.shelfLayout";

/** Defaults to the grid. */
export function parseShelfLayout(raw: string | null | undefined): ShelfLayout {
  return raw === "list" ? "list" : "grid";
}

function read(): ShelfLayout {
  try {
    return parseShelfLayout(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can throw in a hardened webview.
    return "grid";
  }
}

/** Plain state: shelves are separate routes, never visible together. */
export function useShelfLayout(): [ShelfLayout, (layout: ShelfLayout) => void] {
  const [layout, setLayout] = useState<ShelfLayout>(read);

  return [
    layout,
    (next: ShelfLayout) => {
      setLayout(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage unavailable: the choice holds for this session.
      }
    },
  ];
}
