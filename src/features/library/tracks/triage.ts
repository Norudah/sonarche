import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, FAMILY_OTHER, familyKeyOf } from "@/features/library/genres/genres";
import { decadeOf } from "@/features/library/tracks/facets";

/** Sentinel `?genre=` values (`triagePaths` in `@/app/paths`); anything else
 * is a genre name. */
export const GENRE_MISSING = "missing";
export const GENRE_OFF_TREE = "off-tree";

/** Everything the URL says about which tracks to show: correction filters from
 * the Metadata page and browsing axes, parsed the same way. */
export interface TrackTriage {
  missingYear: boolean;
  /** `?missing=track`, sharing the param with the year (exclusive). */
  missingTrackNumber: boolean;
  /** A sentinel or a genre name. */
  genre: string | null;
  /** `?family=`, a genre family key. */
  family: string | null;
  /** `?category=`, a stored grouping value. */
  category: string | null;
  /** `?decade=1990`, the decade's first year. */
  decade: number | null;
  /** `?suspect=match` */
  suspectMatch: boolean;
  /** `?duplicates=recording` */
  duplicateRecording: boolean;
}

/** Nothing active, next to the type so a new axis can't be forgotten. */
export const NO_TRIAGE: TrackTriage = {
  missingYear: false,
  missingTrackNumber: false,
  genre: null,
  family: null,
  category: null,
  decade: null,
  suspectMatch: false,
  duplicateRecording: false,
};

/** Normalised through `decadeOf`; non-numeric values are dropped. */
function parseDecade(raw: string | null): number | null {
  if (raw == null) return null;
  const year = Number.parseInt(raw, 10);
  return Number.isFinite(year) ? decadeOf(year) : null;
}

export function parseTrackTriage(params: URLSearchParams): TrackTriage {
  return {
    missingYear: params.get("missing") === "year",
    missingTrackNumber: params.get("missing") === "track",
    genre: params.get("genre"),
    family: params.get("family"),
    category: params.get("category"),
    decade: parseDecade(params.get("decade")),
    suspectMatch: params.get("suspect") === "match",
    duplicateRecording: params.get("duplicates") === "recording",
  };
}

/** Tracks sharing a recording id with another track; null ids never pair. */
export function duplicateRecordingTracks(tracks: LibraryTrack[]): LibraryTrack[] {
  const seen = new Map<string, number>();
  for (const track of tracks) {
    if (track.mbTrackId != null) seen.set(track.mbTrackId, (seen.get(track.mbTrackId) ?? 0) + 1);
  }
  return tracks.filter((track) => track.mbTrackId != null && (seen.get(track.mbTrackId) ?? 0) > 1);
}

type Predicate = (track: LibraryTrack) => boolean;

/** One test per active filter, cheapest first. */
function predicatesOf(triage: TrackTriage): Predicate[] {
  const tests: Predicate[] = [];

  // Correction filters skip accepted tracks, matching the Metadata counts.
  // Browsing axes don't.
  if (triage.missingYear) tests.push((track) => track.year == null && !track.accepted.includes("year"));
  // beets stores a missing track number as 0.
  if (triage.missingTrackNumber)
    tests.push((track) => (track.track == null || track.track <= 0) && !track.accepted.includes("track"));
  if (triage.decade != null) {
    const decade = triage.decade;
    tests.push((track) => track.year != null && decadeOf(track.year) === decade);
  }
  if (triage.category != null) {
    const category = triage.category;
    tests.push((track) => track.category === category);
  }

  // Through `familyKeyOf`, exactly as the genres page files tracks.
  if (triage.genre === GENRE_MISSING)
    tests.push((track) => familyKeyOf(track) === FAMILY_NONE && !track.accepted.includes("genre"));
  else if (triage.genre === GENRE_OFF_TREE)
    tests.push((track) => familyKeyOf(track) === FAMILY_OTHER && !track.accepted.includes("genre"));
  else if (triage.genre != null) {
    const genre = triage.genre;
    tests.push((track) => track.genre === genre);
  }

  if (triage.family != null) {
    const family = triage.family;
    tests.push((track) => familyKeyOf(track) === family);
  }

  if (triage.suspectMatch) tests.push((track) => track.suspectMatch);

  return tests;
}

/** Filters compose, in one pass. Duplicates run last: they depend on the rest
 * of the set. */
export function applyTrackTriage(tracks: LibraryTrack[], triage: TrackTriage): LibraryTrack[] {
  const tests = predicatesOf(triage);
  // Same reference when nothing is active.
  const result = tests.length === 0 ? tracks : tracks.filter((track) => tests.every((test) => test(track)));
  return triage.duplicateRecording ? duplicateRecordingTracks(result) : result;
}
