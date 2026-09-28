import type { ParseKeys } from "i18next";

export type EraseKey =
  | "eraseLibrary"
  | "eraseArtistImages"
  | "erasePlaylists"
  | "eraseHistory"
  /** Covers all the aimed erases, so it gets its own band in the pane. */
  | "erase";

/** The irreversible erases, mildest first. Shared by the pane that offers them
 * and `SettingsTaskHost`, which runs them. */
export interface EraseDef {
  key: EraseKey;
  /** Listed losses. */
  itemKeys: readonly ParseKeys<"settings">[];
}

export const AIMED_ERASES: EraseDef[] = [
  {
    key: "eraseLibrary",
    itemKeys: ["danger.eraseLibrary.itemFiles", "danger.eraseLibrary.itemIndex", "danger.eraseLibrary.itemPlaylists"],
  },
  { key: "eraseArtistImages", itemKeys: ["danger.eraseArtistImages.itemFiles"] },
  { key: "erasePlaylists", itemKeys: ["danger.erasePlaylists.itemLists", "danger.erasePlaylists.itemCovers"] },
  {
    key: "eraseHistory",
    itemKeys: ["danger.eraseHistory.itemDownloads", "danger.eraseHistory.itemImports", "danger.eraseHistory.itemUndo"],
  },
];

export const FULL_ERASE: EraseDef = {
  key: "erase",
  itemKeys: [
    "danger.erase.itemFiles",
    "danger.erase.itemIndex",
    "danger.erase.itemPlaylists",
    "danger.erase.itemHistory",
    "danger.erase.itemKeys",
  ],
};

export const ERASES: Record<EraseKey, EraseDef> = Object.fromEntries(
  [...AIMED_ERASES, FULL_ERASE].map((def) => [def.key, def]),
) as Record<EraseKey, EraseDef>;

/** These end with a webview reload, so they never get a "done" toast. */
export function reloadsAfter(key: EraseKey): key is "eraseLibrary" | "erase" {
  return key === "eraseLibrary" || key === "erase";
}
