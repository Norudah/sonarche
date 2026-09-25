import type { LibraryTrack, TrackFieldPatch } from "@/features/library/api";

/** Editable and displayed fields, in panel order. */
export interface FieldValues {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
  /** The category (grouping tag); optional, so not in COMPLETENESS_KEYS. */
  category: string;
}

/** `genreBucket` is derived, not fillable. */
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
    category: track.category ?? "",
  };
}

/** Wire keys. `trackTotal` is album-level, edited from the album panel. */
const WIRE_KEY: Record<keyof FieldValues, keyof TrackFieldPatch> = {
  title: "title",
  artist: "artist",
  albumArtist: "albumartist",
  album: "album",
  year: "year",
  track: "track",
  genre: "genre",
  category: "grouping",
};

/** beets integer fields, where 0 means absent. */
const INT_WIRE_FIELDS: ReadonlySet<keyof TrackFieldPatch> = new Set(["year", "track", "tracktotal"]);

const INT_TEXT = /^-?\d+$/;

/** The value an edit would store, or null if it wouldn't change anything.
 * Mirrors the sidecar's rules (trim, integer parsing) so no phantom pending
 * change survives a save. */
export function effectiveEdit(field: keyof TrackFieldPatch, draft: string, live: string): string | null {
  const next = draft.trim();
  const stored = live.trim();
  if (INT_WIRE_FIELDS.has(field)) {
    if (next !== "" && !INT_TEXT.test(next)) return null;
    const nextInt = next === "" ? 0 : Number.parseInt(next, 10);
    const storedInt = INT_TEXT.test(stored) ? Number.parseInt(stored, 10) : 0;
    return nextInt !== storedInt ? next : null;
  }
  return next !== stored ? next : null;
}

export function fieldEdit(key: keyof FieldValues, live: FieldValues, draft: FieldValues): string | null {
  return effectiveEdit(WIRE_KEY[key], draft[key], live[key]);
}

/** Only changed fields, keyed for the sidecar. */
export function diffFields(live: FieldValues, draft: FieldValues): TrackFieldPatch {
  const patch: TrackFieldPatch = {};
  for (const key of Object.keys(WIRE_KEY) as (keyof FieldValues)[]) {
    const value = fieldEdit(key, live, draft);
    if (value != null) patch[WIRE_KEY[key]] = value;
  }
  return patch;
}

/** `192000` bps → `"192"` kbps. */
export function formatBitrate(bitrate: number | null): string | null {
  if (bitrate == null || bitrate <= 0) return null;
  return String(Math.round(bitrate / 1000));
}
