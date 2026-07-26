import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, FAMILY_OTHER, familyKeyOf } from "@/features/library/genres/genres";
import { decadeOf } from "@/features/library/tracks/facets";

/** Sentinel `?genre=` values of the triage contract (`triagePaths` in
 * `@/app/paths`). Any other value is an exact genre name. */
export const GENRE_MISSING = "missing";
export const GENRE_OFF_TREE = "off-tree";

/**
 * Everything the explorer's URL can say about which tracks to show.
 *
 * Two kinds of entry share the shape. The triage deep links (`missing`,
 * `suspect`, `duplicates`, the two `genre` sentinels) are corrections arriving
 * from the Metadata queue; the axes the user picks in the filter bar (`family`,
 * `category`, `decade`, a plain `genre`) are browsing. They parse and apply the
 * same way — only the chip's colour tells them apart.
 */
export interface TrackTriage {
  /** `?missing=year` */
  missingYear: boolean;
  /** `?genre=` — a sentinel, a plain genre name, or null when absent. */
  genre: string | null;
  /** `?family=` — a genre family *key* (the genres page's own segment), the
   * whole-family counterpart of `?genre=`. Null when absent. */
  family: string | null;
  /** `?category=` — a stored category value (the grouping tag), the axis the
   * category pages file by. Null when absent. */
  category: string | null;
  /** `?decade=1990` — the decade's first year. Null when absent or unparsable. */
  decade: number | null;
  /** `?suspect=match` — matches contradicting the download's own title. */
  suspectMatch: boolean;
  /** `?duplicates=recording` — tracks sharing a MusicBrainz recording. */
  duplicateRecording: boolean;
}

/** Nothing active — the shape to spread from when a caller wants one filter on
 * its own. Declared beside the type so adding an axis cannot leave a call site
 * behind (which is exactly what the category and decade axes did). */
export const NO_TRIAGE: TrackTriage = {
  missingYear: false,
  genre: null,
  family: null,
  category: null,
  decade: null,
  suspectMatch: false,
  duplicateRecording: false,
};

/** Normalised through `decadeOf`, so a hand-edited `?decade=1994` lands on the
 * nineties instead of matching nothing. Anything non-numeric is dropped rather
 * than filtering the list down to zero on a typo. */
function parseDecade(raw: string | null): number | null {
  if (raw == null) return null;
  const year = Number.parseInt(raw, 10);
  return Number.isFinite(year) ? decadeOf(year) : null;
}

export function parseTrackTriage(params: URLSearchParams): TrackTriage {
  return {
    missingYear: params.get("missing") === "year",
    genre: params.get("genre"),
    family: params.get("family"),
    category: params.get("category"),
    decade: parseDecade(params.get("decade")),
    suspectMatch: params.get("suspect") === "match",
    duplicateRecording: params.get("duplicates") === "recording",
  };
}

/** Tracks whose recording id another track of the list also carries — the
 * same audio filed twice (a playlist re-importing an already-owned single).
 * Unmatched tracks (null id) never pair up. */
export function duplicateRecordingTracks(tracks: LibraryTrack[]): LibraryTrack[] {
  const seen = new Map<string, number>();
  for (const track of tracks) {
    if (track.mbTrackId != null) seen.set(track.mbTrackId, (seen.get(track.mbTrackId) ?? 0) + 1);
  }
  return tracks.filter((track) => track.mbTrackId != null && (seen.get(track.mbTrackId) ?? 0) > 1);
}

type Predicate = (track: LibraryTrack) => boolean;

/** One test per active filter. Order is irrelevant to the result, so the cheap
 * comparisons come first and a track filtered out by year never has its family
 * resolved. */
function predicatesOf(triage: TrackTriage): Predicate[] {
  const tests: Predicate[] = [];

  if (triage.missingYear) tests.push((track) => track.year == null);
  if (triage.decade != null) {
    const decade = triage.decade;
    tests.push((track) => track.year != null && decadeOf(track.year) === decade);
  }
  if (triage.category != null) {
    const category = triage.category;
    tests.push((track) => track.category === category);
  }

  // The two sentinels go through `familyKeyOf`, so a track counts as
  // unclassified or off-tree here exactly when the genres page files it that
  // way. Anything else is an exact genre name.
  if (triage.genre === GENRE_MISSING) tests.push((track) => familyKeyOf(track) === FAMILY_NONE);
  else if (triage.genre === GENRE_OFF_TREE) tests.push((track) => familyKeyOf(track) === FAMILY_OTHER);
  else if (triage.genre != null) {
    const genre = triage.genre;
    tests.push((track) => track.genre === genre);
  }

  // The family key resolves through `familyKeyOf` too, so "show this family's
  // tracks" lands on exactly the set the family page counted.
  if (triage.family != null) {
    const family = triage.family;
    tests.push((track) => familyKeyOf(track) === family);
  }

  if (triage.suspectMatch) tests.push((track) => track.suspectMatch);

  return tests;
}

/**
 * Filters compose: `?missing=year&genre=missing` means both at once.
 *
 * One pass over the library rather than one `.filter()` per active filter. With
 * seven possible axes, chaining allocated up to seven intermediate arrays of a
 * library-sized list to answer a question a single traversal answers — and each
 * track now short-circuits on its first failing test instead of surviving every
 * stage.
 *
 * Duplicates cannot join that pass: a track is a duplicate only relative to the
 * rest of the set, so it runs last, over whatever the per-track tests left.
 */
export function applyTrackTriage(tracks: LibraryTrack[], triage: TrackTriage): LibraryTrack[] {
  const tests = predicatesOf(triage);
  // The untouched array by reference, not a copy: this is the default state of
  // every explorer, and it must not allocate.
  const result = tests.length === 0 ? tracks : tracks.filter((track) => tests.every((test) => test(track)));
  return triage.duplicateRecording ? duplicateRecordingTracks(result) : result;
}
