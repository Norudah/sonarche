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
  /** The category axis (grouping tag). Editable but optional by nature, so it
   * is deliberately absent from COMPLETENESS_KEYS — a plain studio album must
   * not read as 7/8 for lacking one. */
  category: string;
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
    category: track.category ?? "",
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
  category: "grouping",
};

/** Wire fields beets stores as integers, where 0 means "absent". */
const INT_WIRE_FIELDS: ReadonlySet<keyof TrackFieldPatch> = new Set(["year", "track", "tracktotal"]);

const INT_TEXT = /^-?\d+$/;

/**
 * The value an edit would actually store, or null when it would not move the
 * stored one. Mirrors the sidecar's write rules — text is trimmed, an int
 * field must parse (a non-numeric value is skipped, an emptied one clears to
 * 0/"absent") — so "pending change" means exactly "a save would write
 * something". Diffing raw drafts against stored values left phantom pending
 * changes that survived their own save: the exit guard fired after a
 * successful write, and re-saving the phantom could overwrite real tags.
 */
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

/** `effectiveEdit` for one form field, keyed by its front name. */
export function fieldEdit(key: keyof FieldValues, live: FieldValues, draft: FieldValues): string | null {
  return effectiveEdit(WIRE_KEY[key], draft[key], live[key]);
}

/** Only the fields the user actually changed, keyed for the sidecar. Sending
 * just the diff keeps the write minimal — the sidecar re-tags a file only when
 * a value moved. */
export function diffFields(live: FieldValues, draft: FieldValues): TrackFieldPatch {
  const patch: TrackFieldPatch = {};
  for (const key of Object.keys(WIRE_KEY) as (keyof FieldValues)[]) {
    const value = fieldEdit(key, live, draft);
    if (value != null) patch[WIRE_KEY[key]] = value;
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
