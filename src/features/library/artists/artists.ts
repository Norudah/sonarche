import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { normalize } from "@/shared/lib/text";

export interface Artist {
  /** Album artist. Also the identity and the route segment — beets gives us no
   * artist id, and adopting the MusicBrainz one would mean persisting a field
   * `library.py` does not expose yet. */
  name: string;
  /** Chronological, undated albums last: a discography reads by era. */
  albums: Album[];
  trackCount: number;
  /** Summed playtime in seconds across every album. */
  length: number;
  /** Up to four distinct covers, most recent album first — the mosaic thumbnail. */
  artUrls: string[];
  /** Earliest and latest dated album, or null when nothing is dated. */
  span: { from: number; to: number } | null;
  /** Distinct genres across the discography, most frequent first. */
  genres: string[];
}

/** Newest first for the mosaic, oldest first for the discography — hence the
 * two call sites rather than one shared comparator. Undated albums always sink. */
function byYearAscending(a: Album, b: Album): number {
  if (a.year == null && b.year == null) return a.title.localeCompare(b.title);
  if (a.year == null) return 1;
  if (b.year == null) return -1;
  return a.year - b.year;
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

/** Four at most, and distinct: an artist whose albums all share one cover gets a
 * single full-bleed tile instead of the same image printed four times. */
function mosaicCovers(albums: Album[]): string[] {
  const seen = new Set<string>();
  for (const album of [...albums].reverse()) {
    if (album.artUrl) seen.add(album.artUrl);
    if (seen.size === 4) break;
  }
  return Array.from(seen);
}

/**
 * Derived from the already-grouped albums rather than from the flat track list:
 * an artist *is* a set of albums here, and regrouping the tracks a second time
 * would be the same work twice for the same answer.
 */
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
      artUrls: mosaicCovers(ordered),
      span: spanOf(ordered),
      genres: distinctGenres(ordered),
    };
  });
}

/**
 * Tracks credited to this artist on someone else's album — the one thing the
 * artist page shows that no other view does.
 *
 * Exact match on the track artist, not a substring: "Daft Punk" would otherwise
 * claim every "Daft Punk Remix" in the library. A featuring credit buried in a
 * combined artist string is a tagging question, not a grouping one, and beets
 * gives us no separate credit list to do better.
 */
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
    // Ties broken by name so the grid has a stable order rather than reshuffling
    // between renders on a library where most artists have one album.
    case "albums":
      return sorted.sort((a, b) => b.albums.length - a.albums.length || a.name.localeCompare(b.name));
    case "tracks":
      return sorted.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
  }
}

/** Same contract as `filterAlbums`: every term must match somewhere, so
 * "daft dis" finds Daft Punk through Discovery. */
export function filterArtists(artists: Artist[], query: string): Artist[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return artists;

  return artists.filter((artist) => {
    const haystack = normalize(
      [artist.name, ...artist.albums.map((album) => album.title), ...artist.genres].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

export function findArtist(artists: Artist[], name: string): Artist | null {
  return artists.find((artist) => artist.name === name) ?? null;
}
