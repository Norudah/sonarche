import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * The Rust playback engine, as the front sees it.
 *
 * Every call here is a Tauri command; the engine owns the audio device and a
 * queue of files, and knows nothing about tracks, albums or shuffle. Wrapped in
 * one module so `PlayerContext` reads as playback logic rather than as a string
 * of `invoke` calls, and so the wire names live in a single place.
 */

/** Play a file now, dropping whatever was queued. Resolves to the duration the
 * engine actually decoded, in seconds — the figure the seek bar should trust. */
export function load(path: string): Promise<number | null> {
  return invoke<number | null>("player_load", { path });
}

/** Queue a file behind the playing one, for a hand-over with no gap. */
export function enqueue(path: string): Promise<void> {
  return invoke("player_enqueue", { path });
}

/** Flip play/pause. Resolves to whether it is playing afterwards. */
export function toggle(): Promise<boolean> {
  return invoke<boolean>("player_toggle");
}

export function pause(): Promise<void> {
  return invoke("player_pause");
}

export function seek(seconds: number): Promise<void> {
  return invoke("player_seek", { seconds });
}

/** `level` is the slider position, 0…1. The engine applies the audio taper. */
export function setVolume(level: number): Promise<void> {
  return invoke("player_set_volume", { level });
}

export function stop(): Promise<void> {
  return invoke("player_stop");
}

/** What the engine reports about itself, pushed on change. */
export interface PlaybackStatus {
  position: number;
  duration: number | null;
  isPlaying: boolean;
  /** Anything loaded at all. Separates "paused" from "finished", which both
   * report `isPlaying: false`. */
  loaded: boolean;
  queued: number;
}

/** Subscribe to the playhead. Resolves to the unsubscribe function. */
export function onStatus(handler: (status: PlaybackStatus) => void) {
  return listen<PlaybackStatus>("player:status", (event) => handler(event.payload));
}

/** Subscribe to "the engine ran out of audio on its own" — the front owns the
 * queue, so it is the one that decides what happens next. */
export function onEnded(handler: () => void) {
  return listen("player:ended", () => handler());
}
