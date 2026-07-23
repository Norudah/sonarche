import type { LibraryTrack, TrackFieldPatch } from "@/features/library/api";

/** Editable + displayed metadata fields, in panel order. */
export interface FieldValues {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
}

/** Fields counted by the completeness meter. `genreBucket` is excluded: it is
 * derived from the genre, not a tag the user can fill in. */
export const COMPLETENESS_KEYS: readonly (keyof FieldValues)[] = [
  "title",
  "artist",
  "albumArtist",
  "album",
  "year",
  "track",
  "genre",
];

export function toFieldValues(track: LibraryTrack): FieldValues {
  return {
    title: track.title,
    artist: track.artist,
    albumArtist: track.albumArtist,
    album: track.album,
    year: track.year != null ? String(track.year) : "",
    track: track.track != null ? String(track.track) : "",
    genre: track.genre ?? "",
  };
}

/** Wire key for each editable field. `albumArtist` is beets' `albumartist`; the
 * rest match. `trackTotal` is album-level and edited from the album panel, so
 * it is deliberately absent here. */
const WIRE_KEY: Record<keyof FieldValues, keyof TrackFieldPatch> = {
  title: "title",
  artist: "artist",
  albumArtist: "albumartist",
  album: "album",
  year: "year",
  track: "track",
  genre: "genre",
};

/** Only the fields the user actually changed, keyed for the sidecar. Sending
 * just the diff keeps the write minimal — the sidecar re-tags a file only when
 * a value moved. */
export function diffFields(live: FieldValues, draft: FieldValues): TrackFieldPatch {
  const patch: TrackFieldPatch = {};
  for (const key of Object.keys(WIRE_KEY) as (keyof FieldValues)[]) {
    if (draft[key] !== live[key]) patch[WIRE_KEY[key]] = draft[key];
  }
  return patch;
}

export function countFilled(values: FieldValues): number {
  return COMPLETENESS_KEYS.filter((key) => values[key].trim() !== "").length;
}

/** A single track's tag score as a ratio, not a percentage: "5/7" says which
 * fields are missing is a countable, fixable thing, where "71%" reads as a
 * grade. Same reason the album card counts tracks rather than averaging them. */
export function tagCounts(track: LibraryTrack): { filled: number; total: number } {
  return {
    filled: countFilled(toFieldValues(track)),
    total: COMPLETENESS_KEYS.length,
  };
}

/** `192000` (bps, as beets reports it) → `"192"` kbps. */
export function formatBitrate(bitrate: number | null): string | null {
  if (bitrate == null || bitrate <= 0) return null;
  return String(Math.round(bitrate / 1000));
}
