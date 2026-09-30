import { invoke } from "@tauri-apps/api/core";

/** One timed LRC line, parsed by the sidecar. */
export interface LyricLine {
  time: number;
  text: string;
}

export interface Lyrics {
  /** `"library"` means already stored; null when nothing was found. */
  source: "library" | "lrclib" | "lyrics.ovh" | null;
  plain: string | null;
  /** Empty for plain-text sources. */
  lines: LyricLine[];
  /** Known recording without words. */
  instrumental: boolean;
  /** Neither source answered: not our error, not the user's connection. */
  unreachable: boolean;
}

/** The sidecar's wire shape, mapped explicitly so a rename fails here. */
interface WireLyrics {
  source: "library" | "lrclib" | "lyrics.ovh" | null;
  plain: string | null;
  lines: LyricLine[];
  instrumental: boolean;
  unreachable: boolean;
}

/**
 * Lyrics for one track. `allowNetwork` is false when the panel opens (stored
 * lyrics only) and true after the user presses the button. `force` skips
 * stored lyrics without erasing them.
 */
export async function fetchLyrics(id: number, allowNetwork: boolean, force = false): Promise<Lyrics> {
  const wire = await invoke<WireLyrics>("fetch_lyrics", { id, allowNetwork, force });
  return {
    source: wire.source,
    plain: wire.plain,
    lines: wire.lines,
    instrumental: wire.instrumental,
    unreachable: wire.unreachable,
  };
}

/** The line playing at `time` (the last one started), or -1. A backward scan
 * is enough for a few hundred lines. */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (time >= lines[index].time) return index;
  }
  return -1;
}
