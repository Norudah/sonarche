import type { LibraryTrack } from "@/features/library/api";

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
  const trackNumber =
    track.track != null
      ? track.trackTotal != null
        ? `${track.track} / ${track.trackTotal}`
        : String(track.track)
      : "";
  return {
    title: track.title,
    artist: track.artist,
    albumArtist: track.albumArtist,
    album: track.album,
    year: track.year != null ? String(track.year) : "",
    track: trackNumber,
    genre: track.genre ?? "",
  };
}

export function countFilled(values: FieldValues): number {
  return COMPLETENESS_KEYS.filter((key) => values[key].trim() !== "").length;
}

/** `192000` (bps, as beets reports it) → `"192"` kbps. */
export function formatBitrate(bitrate: number | null): string | null {
  if (bitrate == null || bitrate <= 0) return null;
  return String(Math.round(bitrate / 1000));
}
