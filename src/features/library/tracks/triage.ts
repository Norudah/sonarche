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
  /** `?family=` — a genre family *key* (the genres page's own segment), the
   * whole-family counterpart of `?genre=`. Null when absent. */
  family: string | null;
  /** `?suspect=match` — matches contradicting the download's own title. */
  suspectMatch: boolean;
  /** `?duplicates=recording` — tracks sharing a MusicBrainz recording. */
  duplicateRecording: boolean;
}

export function parseTrackTriage(params: URLSearchParams): TrackTriage {
  return {
    missingYear: params.get("missing") === "year",
    genre: params.get("genre"),
    family: params.get("family"),
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
  // The family key goes through `familyKeyOf` too, so "show this family's
  // tracks" lands on exactly the set the family page counted — the sentinels
  // included, which is what makes the genre-less pile browsable here.
  if (triage.family != null) result = result.filter((track) => familyKeyOf(track) === triage.family);
  if (triage.suspectMatch) result = result.filter((track) => track.suspectMatch);
  if (triage.duplicateRecording) result = duplicateRecordingTracks(result);
  return result;
}
