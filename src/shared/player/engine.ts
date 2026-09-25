import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Typed wrappers over the Rust playback engine's commands and events. The
 * engine owns the audio device and a file queue; it knows nothing of tracks. */

/** Plays a file now, dropping the queue. Resolves to the decoded duration. */
export function load(path: string): Promise<number | null> {
  return invoke<number | null>("player_load", { path });
}

/** Queues a file behind the playing one for a gapless transition. */
export function enqueue(path: string): Promise<void> {
  return invoke("player_enqueue", { path });
}

/** Resolves to whether it is playing afterwards. */
export function toggle(): Promise<boolean> {
  return invoke<boolean>("player_toggle");
}

export function pause(): Promise<void> {
  return invoke("player_pause");
}

export function seek(seconds: number): Promise<void> {
  return invoke("player_seek", { seconds });
}

/** `level` is the 0…1 slider position; the engine applies the taper. */
export function setVolume(level: number): Promise<void> {
  return invoke("player_set_volume", { level });
}

export function stop(): Promise<void> {
  return invoke("player_stop");
}

/** Pushed on change. */
export interface PlaybackStatus {
  position: number;
  duration: number | null;
  isPlaying: boolean;
  /** Separates "paused" from "finished" (both `isPlaying: false`). */
  loaded: boolean;
  queued: number;
}

/** Resolves to the unsubscribe function. */
export function onStatus(handler: (status: PlaybackStatus) => void) {
  return listen<PlaybackStatus>("player:status", (event) => handler(event.payload));
}

/** The engine ran out of audio; the front's queue decides what's next. */
export function onEnded(handler: () => void) {
  return listen("player:ended", () => handler());
}

/** The preloaded file the engine moved into. By path, since the front's
 * queue may have changed since. */
export interface HandedOver {
  path: string;
  duration: number | null;
}

/** Gapless hand-over; no `ended` fires. */
export function onAdvanced(handler: (file: HandedOver) => void) {
  return listen<HandedOver>("player:advanced", (event) => handler(event.payload));
}

/** OS media session info, separate from `load` which only takes a path. */
export interface NowPlayingTrack {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  /** Cover path on disk (not the asset URL); Rust adapts it per platform. */
  artPath?: string | null;
  duration?: number | null;
}

export function setNowPlaying(track: NowPlayingTrack): Promise<void> {
  return invoke("now_playing_set", { track });
}

/** A system control press; `seek` is an absolute position in seconds. */
export type RemoteAction = "play" | "pause" | "toggle" | "next" | "previous" | "stop" | { seek: number };

export function onRemote(handler: (action: RemoteAction) => void) {
  return listen<RemoteAction>("player:remote", (event) => handler(event.payload));
}
