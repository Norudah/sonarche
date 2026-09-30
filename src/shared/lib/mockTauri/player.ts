/** A stand-in for the Rust playback engine (no audio) and the lyrics lookup. */

import type { Handler } from "./types";
import { emitMockEvent } from "./events";
import { isPlayablePath } from "./library";

const playback = { position: 0, duration: 0, isPlaying: false, loaded: false, queued: 0, timer: 0 };

function emitPlaybackStatus() {
  const { position, duration, isPlaying, loaded, queued } = playback;
  emitMockEvent("player:status", { position, duration, isPlaying, loaded, queued });
}

function tickPlayback() {
  window.clearInterval(playback.timer);
  playback.timer = window.setInterval(() => {
    if (!playback.isPlaying) return;
    playback.position += 0.25;
    if (playback.duration > 0 && playback.position >= playback.duration) {
      playback.position = 0;
      playback.isPlaying = false;
      playback.loaded = false;
      emitMockEvent("player:ended", null);
    }
    emitPlaybackStatus();
  }, 250);
}

export function mockPlayback(cmd: string, payload?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "player_load":
      // Same wording as the engine: `playbackError.ts` matches the prefix.
      if (!isPlayablePath(String(payload?.path ?? ""))) {
        throw `unsupported audio format: ${String(payload?.path ?? "")}`;
      }
      playback.position = 0;
      playback.duration = 214;
      playback.isPlaying = true;
      playback.loaded = true;
      tickPlayback();
      return playback.duration;
    case "player_toggle":
      playback.isPlaying = !playback.isPlaying;
      return playback.isPlaying;
    case "player_seek":
      playback.position = Number(payload?.seconds ?? 0);
      emitPlaybackStatus();
      return null;
    case "player_stop":
      playback.isPlaying = false;
      playback.loaded = false;
      return null;
    case "now_playing_set":
      // Acknowledged; `emitMockEvent("player:remote", …)` simulates a media key.
      return null;
    default:
      return null;
  }
}

/**
 * Placeholder lyrics (not a real song) reproducing each answer's shape:
 * 100 has stored lyrics, 101 and 102 need the button, 200 is instrumental.
 */
const mockLyricLines = (offset: number) =>
  [
    ...["Placeholder verse, first line", "Placeholder verse, second line", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again", ""],
    ...["Placeholder second verse, first line", "Placeholder second verse, second line", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again", ""],
    ...["Placeholder bridge, quietly", "Placeholder bridge, quieter still", ""],
    ...["Placeholder chorus, over and over", "Placeholder chorus, once again"],
    "Placeholder verse, last line",
    // Long enough to exercise the scroll that follows the playhead.
  ].map((text, index) => ({ time: offset + index * 4, text }));

async function mockLyrics(payload?: Record<string, unknown>): Promise<unknown> {
  const id = Number(payload?.id ?? 0);
  const allowNetwork = Boolean(payload?.allowNetwork);
  const force = Boolean(payload?.force);
  const answer = (over: Record<string, unknown> = {}) => ({
    source: null,
    plain: null,
    lines: [],
    instrumental: false,
    unreachable: false,
    ...over,
  });
  const plainBody =
    "Placeholder verse, first line\nPlaceholder verse, second line\n\nPlaceholder chorus, over and over";

  if (id === 100 && !force)
    return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(6) });
  if (!allowNetwork) return answer();

  await new Promise((resolve) => window.setTimeout(resolve, 900));
  if (id === 100) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(6) });
  if (id === 101) return answer({ source: "lrclib", plain: "Placeholder verse, first line", lines: mockLyricLines(4) });
  // Plain text until "look again" returns timed lyrics.
  if (id === 102)
    return force
      ? answer({ source: "lrclib", plain: plainBody, lines: mockLyricLines(5) })
      : answer({ source: "lyrics.ovh", plain: plainBody });
  // LRCLIB accepting the connection and never answering.
  if (id === 103) return answer({ unreachable: true });
  if (id === 200) return answer({ source: "lrclib", instrumental: true });
  return answer();
}

export const handlers: Record<string, Handler> = {
  fetch_lyrics: (payload) => mockLyrics(payload),
};
