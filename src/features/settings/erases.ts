import { Disc3, History, ImageOff, ListX, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The irreversible erases, mildest first, and what each one takes.
 *
 * Shared between the pane that offers them and the host that runs them: the
 * two live on opposite sides of the settings dialog on purpose (see
 * `SettingsTaskHost`), and neither may own this table alone.
 */
export interface EraseDef {
  key: EraseKey;
  icon: LucideIcon;
  /** The losses the dialog lists, one line each, as `danger.<key>.<item>`. */
  itemKeys: readonly string[];
  /** Whether finishing takes the webview down with it. */
  reloads: boolean;
}

export type EraseKey =
  | "eraseLibrary"
  | "eraseArtistImages"
  | "erasePlaylists"
  | "eraseHistory"
  /** Not in `AIMED_ERASES`: it covers every one of them, and the pane gives it
   * a band of its own so the eye has to cross a boundary to reach it. */
  | "erase";

export const AIMED_ERASES: EraseDef[] = [
  { key: "eraseLibrary", icon: Disc3, itemKeys: ["itemFiles", "itemIndex", "itemPlaylists"], reloads: true },
  { key: "eraseArtistImages", icon: ImageOff, itemKeys: ["itemFiles"], reloads: false },
  { key: "erasePlaylists", icon: ListX, itemKeys: ["itemLists", "itemCovers"], reloads: false },
  { key: "eraseHistory", icon: History, itemKeys: ["itemDownloads", "itemImports", "itemUndo"], reloads: false },
];

export const FULL_ERASE: EraseDef = {
  key: "erase",
  icon: Trash2,
  itemKeys: ["itemFiles", "itemIndex", "itemPlaylists", "itemHistory", "itemKeys"],
  reloads: true,
};

/** Every erase by key, so a task carrying only a key can find what it takes
 * without a lookup that might miss. */
export const ERASES: Record<EraseKey, EraseDef> = Object.fromEntries(
  [...AIMED_ERASES, FULL_ERASE].map((def) => [def.key, def]),
) as Record<EraseKey, EraseDef>;
