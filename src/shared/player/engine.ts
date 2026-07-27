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

/** The file the engine crossed into by itself, having been handed it ahead of
 * time. Identified by path rather than by queue slot: the front's queue can
 * have moved since, and the path is what settles which track is being heard. */
export interface HandedOver {
  path: string;
  duration: number | null;
}

/** Subscribe to the gapless hand-over. Nothing stopped, so no `ended` fires —
 * this is the only sign the playing track changed. */
export function onAdvanced(handler: (file: HandedOver) => void) {
  return listen<HandedOver>("player:advanced", (event) => handler(event.payload));
}

/** What the OS shows: media keys, Control Center, the lock screen. Sent
 * separately from `load` because the engine is handed a file path, and a track
 * is more than that. */
export interface NowPlayingTrack {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  /** Absolute path to the cover on disk — Rust turns it into the URL each
   * platform wants. Not the asset URL the UI draws with. */
  artPath?: string | null;
  duration?: number | null;
}

export function setNowPlaying(track: NowPlayingTrack): Promise<void> {
  return invoke("now_playing_set", { track });
}

/** A press on a system control. `seek` carries an absolute position in seconds
 * from the lock screen's scrubber. */
export type RemoteAction = "play" | "pause" | "toggle" | "next" | "previous" | "stop" | { seek: number };

export function onRemote(handler: (action: RemoteAction) => void) {
  return listen<RemoteAction>("player:remote", (event) => handler(event.payload));
}
