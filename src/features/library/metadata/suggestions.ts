import type { LibraryTrack } from "@/features/library/api";
import { createTextFilter } from "@/shared/lib/search";

/** Suggestion pools derived from the loaded library, so edits reuse existing
 * spellings. */

export type SuggestKind = "artist" | "album" | "genre";

export interface Suggestion {
  /** Exact stored string, written as is. */
  value: string;
  /** The album's artist, or the genre's family. */
  detail?: string;
  /** Tracks carrying it. */
  count: number;
  /** Album cover URL (album pool only). */
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
    // One pool for track and album artists; counted once per track.
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

/** Detail is searched too, so "daft disc" finds Discovery. */
export const filterSuggestions = createTextFilter<Suggestion>(
  (suggestion) => `${suggestion.value} ${suggestion.detail ?? ""}`,
);

/** Whether the text is exactly a stored entry. */
export function hasExactSuggestion(pool: Suggestion[], value: string): boolean {
  const typed = value.trim();
  return typed !== "" && pool.some((suggestion) => suggestion.value === typed);
}
