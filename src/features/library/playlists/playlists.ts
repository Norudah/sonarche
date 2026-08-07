import type { LibraryTrack } from "@/features/library/api";
import type { Playlist } from "@/features/library/playlists/api";

/**
 * A playlist's members joined back against the library, order preserved.
 *
 * Ids the library no longer answers for are dropped rather than rendered as
 * holes: the backend prunes memberships when a track is deleted, so a stale id
 * here means the library was rebuilt behind the store's back — the one case
 * where silently showing what still exists is the honest answer.
 */
export function resolvePlaylistTracks(itemIds: number[], byId: Map<number, LibraryTrack>): LibraryTrack[] {
  const tracks: LibraryTrack[] = [];
  for (const id of itemIds) {
    const track = byId.get(id);
    if (track) tracks.push(track);
  }
  return tracks;
}

/** The library keyed by item id — built once per listing, shared by every
 * playlist surface on the page. */
export function tracksById(tracks: LibraryTrack[]): Map<number, LibraryTrack> {
  return new Map(tracks.map((track) => [track.id, track]));
}

/**
 * The covers a playlist's tile is made of: the first four *distinct* artworks
 * in playing order. Distinct, because a playlist built from one album would
 * otherwise show the same sleeve four times and read as a bug. Fewer than four
 * means the tile shows the first alone — a 2×2 with holes reads as broken,
 * and a lone cover is what a young playlist honestly looks like.
 */
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

/** Total seconds of the members whose duration is known. */
export function playlistDuration(tracks: LibraryTrack[]): number {
  return tracks.reduce((sum, track) => sum + (track.length ?? 0), 0);
}

/** Case-insensitive name collision, the same rule the backend enforces —
 * checked here first so the dialog can refuse before the round-trip. */
export function playlistNameTaken(playlists: Playlist[], name: string, excludingId?: number): boolean {
  const wanted = name.trim().toLowerCase();
  return playlists.some((playlist) => playlist.id !== excludingId && playlist.name.toLowerCase() === wanted);
}
