import { invoke } from "@tauri-apps/api/core";

/** One timed line of an LRC body. The sidecar parses the file format; the front
 * only ever sees seconds and text. */
export interface LyricLine {
  time: number;
  text: string;
}

export interface Lyrics {
  /** Where the text came from, or null when the track has none. `"library"`
   * means it was already stored — no network was touched to answer. */
  source: "library" | "lrclib" | "lyrics.ovh" | null;
  /** The untimed text, always present when something was found. */
  plain: string | null;
  /** The timed lines, empty when the source only had plain text. */
  lines: LyricLine[];
  /** The database knows this recording and says it has no words. */
  instrumental: boolean;
  /** Neither source answered — no `lines`, no `plain`, and no verdict either.
   * Nothing to do with this track and nothing the reader can fix, so it is
   * distinguished from a genuine failure on our side: the panel must not send
   * them to check a connection that is fine. */
  unreachable: boolean;
}

/** The sidecar's own shape. Identical field for field today, and written out
 * anyway: it is the contract, and a rename on either side has to fail here
 * rather than silently hand the panel an `undefined`. */
interface WireLyrics {
  source: "library" | "lrclib" | "lyrics.ovh" | null;
  plain: string | null;
  lines: LyricLine[];
  instrumental: boolean;
  unreachable: boolean;
}

/**
 * Lyrics for one track.
 *
 * `allowNetwork` is the whole permission model: false is the panel opening and
 * reads only what the library holds, true is the user having pressed the
 * button. Nothing else in the app calls this, and nothing calls it in a loop —
 * lyrics are looked up one song at a time, on purpose.
 *
 * `force` is "look again" on a track that already has words: it skips the
 * stored answer without erasing it, so a plain page found while LRCLIB was down
 * can be upgraded to a timed one later, and a fruitless retry costs nothing.
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

/**
 * The line being sung at `time`, or -1 before the first one.
 *
 * A line owns the interval from its own timestamp to the next one, so the
 * answer is the last line that has already started. Called on every playhead
 * tick — a few times a second — over a list that never exceeds a few hundred
 * entries, so a plain backward scan is both the simplest and the cheapest
 * thing here: the answer is almost always the previous one or its neighbour.
 */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (time >= lines[index].time) return index;
  }
  return -1;
}
