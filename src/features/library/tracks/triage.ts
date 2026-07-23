import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, FAMILY_OTHER, familyKeyOf } from "@/features/library/genres/genres";

/** Sentinel `?genre=` values of the triage contract (`triagePaths` in
 * `@/app/paths`). Any other value is an exact genre name. */
export const GENRE_MISSING = "missing";
export const GENRE_OFF_TREE = "off-tree";

/** The tracks explorer's side of the triage deep links. */
export interface TrackTriage {
  /** `?missing=year` */
  missingYear: boolean;
  /** `?genre=` — a sentinel, a plain genre name, or null when absent. */
  genre: string | null;
}

export function parseTrackTriage(params: URLSearchParams): TrackTriage {
  return {
    missingYear: params.get("missing") === "year",
    genre: params.get("genre"),
  };
}

/**
 * Filters compose: `?missing=year&genre=missing` means both at once. The two
 * genre sentinels go through `familyKeyOf`, so a track counts as unclassified
 * or off-tree here exactly when the genres page files it that way.
 */
export function applyTrackTriage(tracks: LibraryTrack[], triage: TrackTriage): LibraryTrack[] {
  let result = tracks;
  if (triage.missingYear) result = result.filter((track) => track.year == null);
  if (triage.genre === GENRE_MISSING) result = result.filter((track) => familyKeyOf(track) === FAMILY_NONE);
  else if (triage.genre === GENRE_OFF_TREE) result = result.filter((track) => familyKeyOf(track) === FAMILY_OTHER);
  else if (triage.genre != null) result = result.filter((track) => track.genre === triage.genre);
  return result;
}
