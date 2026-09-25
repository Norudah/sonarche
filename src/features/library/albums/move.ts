import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/** Pure helpers for moving tracks onto a card, which may span several beets
 * rows while the sidecar takes a single row id. */

/** The row holding most of the card's tracks (oldest on ties); null for singletons. */
export function canonicalAlbumId(album: Album): number | null {
  if (album.albumIds.length === 0) return null;
  const counts = new Map<number, number>();
  for (const track of album.tracks) {
    if (track.albumId != null) counts.set(track.albumId, (counts.get(track.albumId) ?? 0) + 1);
  }
  return [...album.albumIds].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a - b)[0];
}

export interface MoveIntoTarget {
  targetAlbumId: number;
  /** Arrivals first (numbering order), then the card's strays on its other
   * rows, so the move heals a fractured card. */
  itemIds: number[];
}

/** Null when the target has no row (singletons). */
export function moveInto(moving: LibraryTrack[], target: Album): MoveIntoTarget | null {
  const canonical = canonicalAlbumId(target);
  if (canonical == null) return null;
  const movingIds = new Set(moving.map((track) => track.id));
  const strays = target.tracks.filter((track) => track.albumId !== canonical && !movingIds.has(track.id));
  return {
    targetAlbumId: canonical,
    itemIds: [...moving.map((track) => track.id), ...strays.map((track) => track.id)],
  };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Pre-ticks "collection" when tracks come from another record; tracks
 * already tagged with the target's album are a repair. */
export function proposeCollection(moving: LibraryTrack[], target: Album): boolean {
  if (target.kind === "collection") return true;
  return moving.some((track) => normalized(track.album) !== normalized(target.title));
}

export function alreadyOn(moving: LibraryTrack[], target: Album): boolean {
  const residents = new Set(target.tracks.map((track) => track.id));
  return moving.length > 0 && moving.every((track) => residents.has(track.id));
}

/** The one artist all moved tracks share, or empty. */
export function suggestedArtist(moving: LibraryTrack[]): string {
  const names = new Set(moving.map((track) => track.artist.trim()).filter(Boolean));
  return names.size === 1 ? [...names][0] : "";
}
