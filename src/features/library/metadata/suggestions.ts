import type { LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

/**
 * Suggestion pools for the metadata editors.
 *
 * The library itself is the vocabulary: every artist, album title and genre
 * already stored is something the user may want to spell *exactly* the same way
 * again — attaching an edit to an existing entry is what keeps one artist from
 * splitting into "AC/DC" and "ACDC". Derived client-side from the one library
 * query, so filtering costs no round-trip.
 */

export type SuggestKind = "artist" | "album" | "genre";

export interface Suggestion {
  /** The exact stored string — selecting writes this, byte for byte. */
  value: string;
  /** Context beside the value: the album's artist, the genre's family. */
  detail?: string;
  /** How many tracks carry the value, for ordering and display. */
  count: number;
  /** The album's cover (display rendition URL) — album pool only. Costs
   * nothing to carry: the URLs already exist on the tracks, and the list draws
   * at most eight of them, lazily, from the webview's cache. */
  image?: string;
}

export type SuggestionPools = Record<SuggestKind, Suggestion[]>;

interface Tally {
  count: number;
  details: Map<string, number>;
  image?: string;
}

function bump(map: Map<string, Tally>, value: string, detail?: string, image?: string) {
  let tally = map.get(value);
  if (!tally) {
    tally = { count: 0, details: new Map() };
    map.set(value, tally);
  }
  tally.count += 1;
  if (detail) tally.details.set(detail, (tally.details.get(detail) ?? 0) + 1);
  if (image && !tally.image) tally.image = image;
}

function toPool(map: Map<string, Tally>): Suggestion[] {
  const pool: Suggestion[] = [];
  for (const [value, tally] of map) {
    let detail: string | undefined;
    let best = 0;
    for (const [candidate, count] of tally.details) {
      if (count > best) {
        best = count;
        detail = candidate;
      }
    }
    pool.push({ value, detail, count: tally.count, image: tally.image });
  }
  return pool.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function buildSuggestionPools(tracks: LibraryTrack[]): SuggestionPools {
  const artists = new Map<string, Tally>();
  const albums = new Map<string, Tally>();
  const genres = new Map<string, Tally>();

  for (const track of tracks) {
    // One artist pool for both name fields: a name known only as a track artist
    // is still the right suggestion for the album-artist field, and vice versa.
    // A track whose two fields agree counts once.
    const names = new Set([track.artist.trim(), track.albumArtist.trim()]);
    names.delete("");
    for (const name of names) bump(artists, name);

    const album = track.album.trim();
    if (album) bump(albums, album, (track.albumArtist || track.artist).trim() || undefined, track.artUrl ?? undefined);

    const genre = track.genre?.trim();
    if (genre) bump(genres, genre, track.genreBucket ?? undefined);
  }

  return { artist: toPool(artists), album: toPool(albums), genre: toPool(genres) };
}

/** Shared across every field: the WeakMap cache is keyed on suggestion object
 * identity, which a refetch renews along with the pools. Detail is part of the
 * haystack so "daft disc" finds Discovery through its artist. */
export const filterSuggestions = createTextFilter<Suggestion>(
  (suggestion) => `${suggestion.value} ${suggestion.detail ?? ""}`,
);

/** Whether the typed text already is a stored entry, exactly — the boundary
 * between "attached to an existing value" and "new value, saved as typed". */
export function hasExactSuggestion(pool: Suggestion[], value: string): boolean {
  const typed = value.trim();
  return typed !== "" && pool.some((suggestion) => suggestion.value === typed);
}
