import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import { withCacheBuster } from "@/features/library/api";
import type { CoverCrop } from "@/features/library/api";

/** `itemIds` in playing order; tags come from the library listing. */
export interface Playlist {
  id: number;
  name: string;
  /** `favorites`: the built-in list (localized label, locked name). */
  kind: "user" | "favorites";
  /** User tile URL; null draws the mosaic. */
  coverUrl: string | null;
  /** The tile's file, for reframing. */
  coverPath: string | null;
  /** `icon:<key>`, `cover` or `color:<key>`; null is the default (see `marker.ts`). */
  marker: string | null;
  createdAt: number;
  updatedAt: number;
  itemIds: number[];
}

interface WirePlaylist {
  id: number;
  name: string;
  kind: string;
  cover_path: string | null;
  marker: string | null;
  created_at: number;
  updated_at: number;
  item_ids: number[];
}

function toPlaylist(wire: WirePlaylist): Playlist {
  return {
    id: wire.id,
    name: wire.name,
    kind: wire.kind === "favorites" ? "favorites" : "user",
    // The filename is stable, so `updated_at` busts the cache.
    coverUrl: wire.cover_path ? withCacheBuster(convertFileSrc(wire.cover_path), wire.updated_at) : null,
    coverPath: wire.cover_path,
    marker: wire.marker ?? null,
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

/** The backend skips ids already present. */
export async function addPlaylistTracks(id: number, itemIds: number[]): Promise<{ added: number; skipped: number }> {
  return invoke("add_playlist_tracks", { id, itemIds });
}

/** Positions in display order. */
export async function removePlaylistTracks(id: number, positions: number[]): Promise<{ removed: number }> {
  return invoke("remove_playlist_tracks", { id, positions });
}

/** Positions in display order. */
export async function movePlaylistTrack(id: number, from: number, to: number): Promise<void> {
  await invoke("move_playlist_track", { id, from, to });
}

/** Same pipeline as artist images (500px square, optional crop). */
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

/** An empty string restores the default glyph. */
export async function setPlaylistMarker(id: number, marker: string): Promise<void> {
  await invoke("set_playlist_marker", { id, marker });
}
