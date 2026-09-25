import { Disc3, History, ImageOff, ListX, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** The irreversible erases, mildest first. Shared by the pane that offers them
 * and `SettingsTaskHost`, which runs them. */
export interface EraseDef {
  key: EraseKey;
  icon: LucideIcon;
  /** Listed losses, as `danger.<key>.<item>`. */
  itemKeys: readonly string[];
  /** Whether it ends with a webview reload. */
  reloads: boolean;
}

export type EraseKey =
  | "eraseLibrary"
  | "eraseArtistImages"
  | "erasePlaylists"
  | "eraseHistory"
  /** Covers all the aimed erases, so it gets its own band in the pane. */
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

export const ERASES: Record<EraseKey, EraseDef> = Object.fromEntries(
  [...AIMED_ERASES, FULL_ERASE].map((def) => [def.key, def]),
) as Record<EraseKey, EraseDef>;
