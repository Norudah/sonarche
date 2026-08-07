import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import type { CoverCrop } from "@/features/library/api";

/** A user-curated playlist. `itemIds` are beets item ids in playing order —
 * titles, covers and durations are joined back from the library listing, so a
 * playlist can never disagree with the library about a track's tags. */
export interface Playlist {
  id: number;
  name: string;
  /** `favorites` for the one built-in list (localized label, locked name);
   * `user` for everything else. */
  kind: "user" | "favorites";
  /** The user-chosen tile, ready to draw — fresh random filename per write, so
   * the URL itself is the cache buster. Null draws the cover mosaic. */
  coverUrl: string | null;
  createdAt: number;
  updatedAt: number;
  itemIds: number[];
}

interface WirePlaylist {
  id: number;
  name: string;
  kind: string;
  cover_path: string | null;
  created_at: number;
  updated_at: number;
  item_ids: number[];
}

function toPlaylist(wire: WirePlaylist): Playlist {
  return {
    id: wire.id,
    name: wire.name,
    kind: wire.kind === "favorites" ? "favorites" : "user",
    coverUrl: wire.cover_path ? convertFileSrc(wire.cover_path) : null,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
    itemIds: wire.item_ids,
  };
}

export async function listPlaylists(): Promise<Playlist[]> {
  const raw = await invoke<{ playlists: WirePlaylist[] }>("list_playlists");
  return raw.playlists.map(toPlaylist);
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const raw = await invoke<{ playlist: WirePlaylist }>("create_playlist", { name });
  return toPlaylist(raw.playlist);
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  await invoke("rename_playlist", { id, name });
}

export async function deletePlaylist(id: number): Promise<void> {
  await invoke("delete_playlist", { id });
}

/** Appends to the end; the backend skips ids the playlist already holds. */
export async function addPlaylistTracks(id: number, itemIds: number[]): Promise<{ added: number; skipped: number }> {
  return invoke("add_playlist_tracks", { id, itemIds });
}

/** Removes the rows at these positions (current display order). */
export async function removePlaylistTracks(id: number, positions: number[]): Promise<{ removed: number }> {
  return invoke("remove_playlist_tracks", { id, positions });
}

/** Moves the row at `from` so it lands at `to`, both in display order. */
export async function movePlaylistTrack(id: number, from: number, to: number): Promise<void> {
  await invoke("move_playlist_track", { id, from, to });
}

/** Give the playlist a tile of its own — same pipeline as an artist image
 * (500px square rendition in app data, optional crop). */
export async function setPlaylistCover(
  id: number,
  sourcePath: string,
  crop: CoverCrop | null,
): Promise<{ id: number; filename: string }> {
  return invoke("set_playlist_cover", { id, sourcePath, crop });
}

/** Back to the mosaic. */
export async function removePlaylistCover(id: number): Promise<{ removed: boolean }> {
  return invoke("remove_playlist_cover", { id });
}
