import type { LibraryTrack } from "@/features/library/api";
import type { Playlist } from "@/features/library/playlists/api";
import { sortTracks, type TrackSort } from "@/features/library/tracks/sort";

/** Members in order. Unknown ids are dropped (the backend prunes deleted
 * tracks, so this only happens after a library rebuild). */
export function resolvePlaylistTracks(itemIds: number[], byId: Map<number, LibraryTrack>): LibraryTrack[] {
  const tracks: LibraryTrack[] = [];
  for (const id of itemIds) {
    const track = byId.get(id);
    if (track) tracks.push(track);
  }
  return tracks;
}

/** Library by item id, cached per listing array (like `groupAlbums`). */
const byIdCache = new WeakMap<LibraryTrack[], Map<number, LibraryTrack>>();

export function tracksById(tracks: LibraryTrack[]): Map<number, LibraryTrack> {
  const hit = byIdCache.get(tracks);
  if (hit) return hit;

  const computed = new Map(tracks.map((track) => [track.id, track]));
  byIdCache.set(tracks, computed);
  return computed;
}

/** The first four distinct covers in playing order. */
export function playlistCovers(tracks: LibraryTrack[]): string[] {
  const covers: string[] = [];
  for (const track of tracks) {
    if (track.artUrl && !covers.includes(track.artUrl)) {
      covers.push(track.artUrl);
      if (covers.length === 4) break;
    }
  }
  return covers;
}

/** Seconds, over tracks with a known duration. */
export function playlistDuration(tracks: LibraryTrack[]): number {
  return tracks.reduce((sum, track) => sum + (track.length ?? 0), 0);
}

/** Case-insensitive, like the backend. `reserved` holds names taken other
 * than as stored names (favorites' localized label). */
export function playlistNameTaken(
  playlists: Playlist[],
  name: string,
  excludingId?: number,
  reserved: string[] = [],
): boolean {
  const wanted = name.trim().toLowerCase();
  if (reserved.some((label) => label.toLowerCase() === wanted)) return true;
  return playlists.some((playlist) => playlist.id !== excludingId && playlist.name.toLowerCase() === wanted);
}

/** A track plus the stored position that mutations address. */
export interface PlaylistViewRow {
  track: LibraryTrack;
  position: number;
}

/** The playlist in its own order or a sort; each row keeps its stored position. */
export function playlistView(tracks: LibraryTrack[], sort: TrackSort | null): PlaylistViewRow[] {
  if (sort == null) return tracks.map((track, position) => ({ track, position }));
  const positionById = new Map(tracks.map((track, position) => [track.id, position]));
  return sortTracks(tracks, sort).map((track) => ({ track, position: positionById.get(track.id) ?? 0 }));
}

/** Favorites first, then the rest by name. */
export function orderedPlaylists(playlists: Playlist[]): Playlist[] {
  return [...playlists].sort((a, b) => Number(b.kind === "favorites") - Number(a.kind === "favorites"));
}

export const SIDEBAR_PLAYLIST_LIMIT = 8;

/** Favorites plus the most recently updated lists, displayed alphabetically
 * so rows don't move around. */
export function sidebarPlaylists(playlists: Playlist[], limit = SIDEBAR_PLAYLIST_LIMIT): Playlist[] {
  const favorites = playlists.filter((playlist) => playlist.kind === "favorites");
  const user = playlists.filter((playlist) => playlist.kind !== "favorites");

  const keep = new Set(
    [...user]
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
      .slice(0, Math.max(0, limit))
      .map((playlist) => playlist.id),
  );
  const shown = user.filter((playlist) => keep.has(playlist.id)).sort((a, b) => a.name.localeCompare(b.name));

  return [...favorites, ...shown];
}
