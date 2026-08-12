import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";

/**
 * The pure half of "move these tracks onto that record": which beets row a
 * card's arrivals converge on, what one request must carry, and what the
 * dialog should propose. The sidecar verb takes item ids and one row id — a
 * card is a (artist, title) group over possibly several rows, and this module
 * is where that mismatch is resolved.
 */

/** The row a fractured card's tracks should converge on: the one already
 * holding most of them — it carries the cover and the answered checks — with
 * the oldest row breaking a tie. Null for a card of singletons. */
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
  /** The arrivals first (their order is the numbering order), then the card's
   * own strays — tracks sitting on the card's other rows, absorbed in the same
   * pass so the move heals a fractured card instead of adding to one side. */
  itemIds: number[];
}

/** What one request must carry to land `moving` on `target`, or null when the
 * target has no row to receive anything (a card of singletons). */
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

/** Whether the dialog should pre-tick "collection". Tracks arriving from
 * another record turn the target into a personal gathering; tracks whose album
 * tag already names the target are a repair — a release coming back together,
 * whose tracklist check is about to be right again. */
export function proposeCollection(moving: LibraryTrack[], target: Album): boolean {
  if (target.kind === "collection") return true;
  return moving.some((track) => normalized(track.album) !== normalized(target.title));
}

/** Every moving track already sits on the target card — nothing would move. */
export function alreadyOn(moving: LibraryTrack[], target: Album): boolean {
  const residents = new Set(target.tracks.map((track) => track.id));
  return moving.length > 0 && moving.every((track) => residents.has(track.id));
}

/** Prefill for the new collection's artist: the one artist every moved track
 * agrees on, or nothing — a mixed pile has no name to suggest. */
export function suggestedArtist(moving: LibraryTrack[]): string {
  const names = new Set(moving.map((track) => track.artist.trim()).filter(Boolean));
  return names.size === 1 ? [...names][0] : "";
}
