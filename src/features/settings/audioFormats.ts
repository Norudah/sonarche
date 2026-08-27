/**
 * The audio formats the app will produce.
 *
 * Mirrors `AUDIO_FORMATS` in `preferences.rs` and `audio_format.py` — the two
 * sides that validate and encode. Three entries, each one a real reason someone
 * would choose it, and the order is the order they are offered in: the free one
 * first, then the two that cost a re-encode.
 *
 * The value is the file extension, all the way down to the sidecar: one string
 * instead of a mapping between "the format", "the container" and "the suffix".
 */
export const AUDIO_FORMATS = ["m4a", "mp3", "flac"] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];

export const DEFAULT_AUDIO_FORMAT: AudioFormat = "m4a";

/** The one format the app can produce without decoding anything: it is the
 * stream the download already received. Everything the interface says about
 * re-encoding hangs off this. */
export function isNativeFormat(format: AudioFormat): boolean {
  return format === DEFAULT_AUDIO_FORMAT;
}

/** A stored preference read back. Anything the backend does not know — a file
 * from another build, a value hand-edited — is "nobody chose". */
export function parseAudioFormat(raw: string | null | undefined): AudioFormat {
  return AUDIO_FORMATS.includes(raw as AudioFormat) ? (raw as AudioFormat) : DEFAULT_AUDIO_FORMAT;
}
