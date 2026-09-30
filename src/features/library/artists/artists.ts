import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, familyKeyOf } from "@/features/library/genres/genres";
import { createTextFilter } from "@/shared/lib/search";

export interface Artist {
  /** The album artist: identity and route segment (beets has no artist id). */
  name: string;
  /** Chronological, undated last. */
  albums: Album[];
  trackCount: number;
  /** Total seconds. */
  length: number;
  /** Earliest and latest dated album, or null. */
  span: { from: number; to: number } | null;
  /** Most frequent first. */
  genres: string[];
  /** Dominant family by track count, or a sentinel (`FAMILY_OTHER` / `FAMILY_NONE`). */
  family: string;
}

function byYearAscending(a: Album, b: Album): number {
  if (a.year == null && b.year == null) return a.title.localeCompare(b.title);
  if (a.year == null) return 1;
  if (b.year == null) return -1;
  return a.year - b.year;
}

/** Ties break on the smaller key, for a stable pick. */
function dominantFamily(albums: Album[]): string {
  const counts = new Map<string, number>();
  for (const album of albums) {
    for (const track of album.tracks) {
      const key = familyKeyOf(track);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let best = FAMILY_NONE;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function spanOf(albums: Album[]): Artist["span"] {
  const years = albums.map((album) => album.year).filter((year): year is number => year != null);
  if (years.length === 0) return null;
  return { from: Math.min(...years), to: Math.max(...years) };
}

function distinctGenres(albums: Album[]): string[] {
  const counts = new Map<string, number>();
  for (const album of albums) {
    for (const genre of album.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre]) => genre);
}

/** Derived from the grouped albums: an artist is a set of albums. */
export function groupArtists(albums: Album[]): Artist[] {
  const groups = new Map<string, Album[]>();

  for (const album of albums) {
    const name = album.artist.trim();
    if (!name) continue;
    const existing = groups.get(name);
    if (existing) existing.push(album);
    else groups.set(name, [album]);
  }

  return Array.from(groups.entries()).map(([name, items]) => {
    const ordered = [...items].sort(byYearAscending);
    return {
      name,
      albums: ordered,
      trackCount: ordered.reduce((sum, album) => sum + album.tracks.length, 0),
      length: ordered.reduce((sum, album) => sum + album.length, 0),
      span: spanOf(ordered),
      genres: distinctGenres(ordered),
      family: dominantFamily(ordered),
    };
  });
}

/** Tracks credited to this artist on others' albums. Exact match, so "Daft
 * Punk" doesn't claim "Daft Punk Remix". */
export function appearancesOf(tracks: LibraryTrack[], name: string): LibraryTrack[] {
  return tracks.filter((track) => {
    const credited = track.artist.trim();
    const owner = track.albumArtist.trim() || credited;
    return credited === name && owner !== name;
  });
}

export const ARTIST_SORTS = ["name", "albums", "tracks"] as const;
export type ArtistSort = (typeof ARTIST_SORTS)[number];

export function sortArtists(artists: Artist[], sort: ArtistSort): Artist[] {
  const sorted = [...artists];
  switch (sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    // Ties by name, for a stable order.
    case "albums":
      return sorted.sort((a, b) => b.albums.length - a.albums.length || a.name.localeCompare(b.name));
    case "tracks":
      return sorted.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
  }
}

/** Every term must match somewhere (as in `filterAlbums`). */
export const filterArtists = createTextFilter<Artist>((artist) =>
  [artist.name, ...artist.albums.map((album) => album.title), ...artist.genres].join(" "),
);

export function findArtist(artists: Artist[], name: string): Artist | null {
  return artists.find((artist) => artist.name === name) ?? null;
}
