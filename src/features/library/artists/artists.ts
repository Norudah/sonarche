import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, familyKeyOf } from "@/features/library/genres/genres";
import { createTextFilter } from "@/shared/lib/search";

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
  /** Earliest and latest dated album, or null when nothing is dated. */
  span: { from: number; to: number } | null;
  /** Distinct genres across the discography, most frequent first. */
  genres: string[];
  /** Dominant browse family, by plurality of tracks — the key that picks the
   * artist's genre avatar. A sentinel (`FAMILY_OTHER`/`FAMILY_NONE`) when the
   * discography carries no classified genre; the avatar falls back for those. */
  family: string;
}

/** Oldest first: a discography reads by era. Undated albums always sink. */
function byYearAscending(a: Album, b: Album): number {
  if (a.year == null && b.year == null) return a.title.localeCompare(b.title);
  if (a.year == null) return 1;
  if (b.year == null) return -1;
  return a.year - b.year;
}

/** Plurality of the tracks' browse family. Ties break on the lexically smaller
 * key so the pick is stable across renders, never on Map iteration order. */
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
      span: spanOf(ordered),
      genres: distinctGenres(ordered),
      family: dominantFamily(ordered),
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
export const filterArtists = createTextFilter<Artist>((artist) =>
  [artist.name, ...artist.albums.map((album) => album.title), ...artist.genres].join(" "),
);

export function findArtist(artists: Artist[], name: string): Artist | null {
  return artists.find((artist) => artist.name === name) ?? null;
}

/**
 * The letter the avatar shows while the artist has no picture.
 *
 * First *grapheme*, not first UTF-16 unit: "Ólafur" must give "Ó" and an
 * emoji-fronted alias must not shear in half. Digits and symbols pass through
 * as they are ("65daysofstatic" → "6"); a blank name gets a music note rather
 * than an empty disc.
 */
export function artistInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : "♪";
}
