/**
 * The audio formats the app will produce.
 *
 * Mirrors `AUDIO_FORMATS` in `preferences.rs` and `audio_format.py` — the two
 * sides that validate and encode. Two entries, each one a real reason someone
 * would choose it, and the order is the order they are offered in: the free one
 * first, then the one that costs a re-encode.
 *
 * flac was a third and was removed. Everything the app writes comes from a
 * lossy stream, so a flac target is lossless *of something that already lost*:
 * bigger files, never better sound, and the only honest label for it was a
 * paragraph of caveats. flac already on disk is still read, played and
 * imported — see `audio_formats.rs` — the app simply does not make it. A stored
 * preference of "flac" reads back as the default here and in `preferences.rs`.
 *
 * The value is the file extension, all the way down to the sidecar: one string
 * instead of a mapping between "the format", "the container" and "the suffix".
 */
export const AUDIO_FORMATS = ["m4a", "mp3"] as const;

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
