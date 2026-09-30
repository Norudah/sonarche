/** Formats the app can produce, mirroring `preferences.rs` and
 * `audio_format.py`. The value is the file extension. A stored "flac" (no
 * longer produced) reads back as the default. */
export const AUDIO_FORMATS = ["m4a", "mp3"] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];

const DEFAULT_AUDIO_FORMAT: AudioFormat = "m4a";

/** The format that needs no re-encode. */
export function isNativeFormat(format: AudioFormat): boolean {
  return format === DEFAULT_AUDIO_FORMAT;
}

/** Unknown values mean "nobody chose". */
export function parseAudioFormat(raw: string | null | undefined): AudioFormat {
  return AUDIO_FORMATS.includes(raw as AudioFormat) ? (raw as AudioFormat) : DEFAULT_AUDIO_FORMAT;
}
