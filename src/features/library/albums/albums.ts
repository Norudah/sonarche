import type { AcceptedCheck, AlbumKind, LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

export interface Album {
  /** Route-safe identity; see `albumKey`. */
  key: string;
  title: string;
  /** Album artist, falling back to the track artist. */
  artist: string;
  year: number | null;
  /** Distinct genres, most frequent first. */
  genres: string[];
  /** By track number, unnumbered last. */
  tracks: LibraryTrack[];
  /** Total seconds; unknown lengths count as zero. */
  length: number;
  artUrl: string | null;
  /** Distinct container formats ("AAC", "FLAC"…). */
  formats: string[];
  /** A card can span several beets albums; it's a collection only if all agree. */
  kind: AlbumKind;
  /** Beets album rows behind the card, ascending; empty for singletons. */
  albumIds: number[];
  /** Album-level accepted checks, all rows agreeing (as for `kind`). */
  accepted: AcceptedCheck[];
}

/** In-memory grouping key and React key; the route uses two segments instead.
 * `␟` can't occur in a tag. */
export function albumKey(artist: string, title: string): string {
  return `${artist}␟${title}`;
}

function albumArtistOf(track: LibraryTrack): string {
  return track.albumArtist.trim() || track.artist.trim();
}

/** Unnumbered tracks sink to the bottom, by title. */
function byTrackNumber(a: LibraryTrack, b: LibraryTrack): number {
  if (a.track == null && b.track == null) return a.title.localeCompare(b.title);
  if (a.track == null) return 1;
  if (b.track == null) return -1;
  return a.track - b.track;
}

function distinctGenres(tracks: LibraryTrack[]): string[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    if (!track.genre) continue;
    counts.set(track.genre, (counts.get(track.genre) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre]) => genre);
}

function recordOf(tracks: LibraryTrack[]): { kind: AlbumKind; albumIds: number[]; accepted: AcceptedCheck[] } {
  const albumIds = Array.from(new Set(tracks.map((track) => track.albumId).filter((id) => id != null))).sort(
    (a, b) => a - b,
  );
  const collection = albumIds.length > 0 && tracks.every((track) => track.albumKind === "collection");
  // Intersection: a check is only done once every row has it.
  const accepted =
    albumIds.length === 0
      ? []
      : tracks
          .map((track) => track.albumAccepted)
          .reduce((common, carried) => common.filter((check) => carried.includes(check)));
  return { kind: collection ? "collection" : "album", albumIds, accepted };
}

function computeAlbums(tracks: LibraryTrack[]): Album[] {
  const groups = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    if (!track.album.trim()) continue;
    const key = albumKey(albumArtistOf(track), track.album);
    const existing = groups.get(key);
    if (existing) existing.push(track);
    else groups.set(key, [track]);
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const ordered = [...items].sort(byTrackNumber);
    return {
      key,
      title: ordered[0].album,
      artist: albumArtistOf(ordered[0]),
      year: ordered.find((track) => track.year != null)?.year ?? null,
      genres: distinctGenres(ordered),
      tracks: ordered,
      length: ordered.reduce((sum, track) => sum + (track.length ?? 0), 0),
      artUrl: ordered.find((track) => track.artUrl)?.artUrl ?? null,
      formats: Array.from(new Set(ordered.map((track) => track.format).filter(Boolean))).sort(),
      ...recordOf(ordered),
    };
  });
}

/**
 * Albums grouped by (album artist, title) on the front, cached by the listing
 * array's identity: several routes need the grouping, and a refetch produces
 * a new array. Albums are never mutated, so sharing them keeps memos stable.
 */
const cache = new WeakMap<LibraryTrack[], Album[]>();

export function groupAlbums(tracks: LibraryTrack[]): Album[] {
  const hit = cache.get(tracks);
  if (hit) return hit;

  const computed = computeAlbums(tracks);
  cache.set(tracks, computed);
  return computed;
}

export const ALBUM_SORTS = ["artist", "title", "year"] as const;
export type AlbumSort = (typeof ALBUM_SORTS)[number];

export function sortAlbums(albums: Album[], sort: AlbumSort): Album[] {
  const sorted = [...albums];
  switch (sort) {
    case "artist":
      // Chronological within an artist.
      return sorted.sort((a, b) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0));
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      // Undated albums last.
      return sorted.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
  }
}

/** Every term must match somewhere, as in `filterTracks`. */
export const filterAlbums = createTextFilter<Album>((album) =>
  [album.title, album.artist, album.year ?? "", ...album.genres].join(" "),
);

/** By the route's two decoded segments, never a re-split joined key. */
export function findAlbum(albums: Album[], artist: string, title: string): Album | null {
  return albums.find((album) => album.artist === artist && album.title === title) ?? null;
}

/** The same record after a rename, found by its track ids (renaming changes
 * the (artist, title) identity). */
export function findAlbumLike(albums: Album[], previous: Album): Album | null {
  const ids = new Set(previous.tracks.map((track) => track.id));
  return albums.find((album) => album.tracks.some((track) => ids.has(track.id))) ?? null;
}
