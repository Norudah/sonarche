import type { LibraryTrack } from "@/features/library/api";
import { COMPLETENESS_KEYS, countFilled, toFieldValues } from "@/features/library/metadata/fields";
import { createTextFilter } from "@/shared/lib/search";

export interface Album {
  /** Stable, URL-safe identity for the album route. See `albumKey`. */
  key: string;
  title: string;
  /** Album artist, falling back to the track artist when beets left it empty. */
  artist: string;
  year: number | null;
  /** Distinct genres present on the album, most frequent first. */
  genres: string[];
  /** Ordered by track number, unnumbered tracks last. */
  tracks: LibraryTrack[];
  /** Summed playtime in seconds; unknown lengths count as zero. */
  length: number;
  artUrl: string | null;
  /** Distinct container formats — "AAC", "FLAC"… */
  formats: string[];
  /** Share of tracked metadata fields that are filled, 0…1. */
  completeness: number;
  /** Tracks whose every tracked field is filled. Counted here rather than in
   * the hero: it rides the pass `completeness` already makes over the tracks. */
  fullyTagged: number;
}

/**
 * Grouping identity, and the React key for a card. Purely in-memory: the album
 * route carries the artist and the title as two separate segments instead, so
 * that no single string ever has to be split back apart. `␟` (␟, the unit
 * separator glyph) cannot occur in a tag, which keeps the join unambiguous.
 */
export function albumKey(artist: string, title: string): string {
  return `${artist}␟${title}`;
}

function albumArtistOf(track: LibraryTrack): string {
  return track.albumArtist.trim() || track.artist.trim();
}

/** Track number ascending; unnumbered tracks sink to the bottom in title order
 * rather than scattering through the list. */
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

/**
 * Fraction of filled metadata cells across the whole album — every track
 * contributes every tracked field. An album where one track of twelve lacks a
 * genre should read as nearly complete, which a per-track "all or nothing"
 * count would not convey.
 */
function tagStatsOf(tracks: LibraryTrack[]): { completeness: number; fullyTagged: number } {
  const total = tracks.length * COMPLETENESS_KEYS.length;
  let filled = 0;
  let fullyTagged = 0;

  for (const track of tracks) {
    const count = countFilled(toFieldValues(track));
    filled += count;
    if (count === COMPLETENESS_KEYS.length) fullyTagged += 1;
  }

  return { completeness: total === 0 ? 1 : filled / total, fullyTagged };
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
      ...tagStatsOf(ordered),
    };
  });
}

/**
 * Cached on the array's identity, exactly like `facetsOf` and for the same
 * reason — but the pressure here is navigation rather than mount count.
 *
 * Albums are derived on the front: `list_library` returns flat items, and beets
 * has no album row we mirror. Identity is (album artist, album title) — not the
 * title alone, so two different "Greatest Hits" stay two albums.
 *
 * Six surfaces need that grouping (the albums shelf, artists, genres,
 * categories and the two detail views), each behind its own route, so a
 * per-component `useMemo` threw the work away on every navigation and paid for
 * it again on arrival — a full pass over the library to walk back into a page
 * that was already computed a second ago. Keying on the array React Query
 * handed out gives the first caller's work to all the others, and a refetch
 * produces a new array, so the entry invalidates itself and the old one is
 * collectable.
 *
 * Sharing the objects is deliberate and safe: nothing mutates an `Album`
 * (`sortAlbums` copies, the triage filters), and stable identities let the
 * memoisation downstream actually hold.
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
      // Within an artist, chronological: a discography reads by era, not A→Z.
      return sorted.sort((a, b) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0));
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      // Undated albums land at the end rather than pretending to be from year 0.
      return sorted.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
  }
}

/** Same contract as `filterTracks`: every whitespace-separated term must match
 * somewhere, so "daft disc" finds Discovery. */
export const filterAlbums = createTextFilter<Album>((album) =>
  [album.title, album.artist, album.year ?? "", ...album.genres].join(" "),
);

/** Looked up by the pair the route carries, not by a joined key: the router
 * hands back already-decoded segments, and re-joining them just to split them
 * again is where an album titled "50% Off" or an artist called "AC|DC" breaks. */
export function findAlbum(albums: Album[], artist: string, title: string): Album | null {
  return albums.find((album) => album.artist === artist && album.title === title) ?? null;
}
