import { invoke } from "@tauri-apps/api/core";

import type { AudioFormat } from "@/features/settings/audioFormats";

export type ApiKeyName = "acoustid";

/** Only whether a key is stored, never the secret. */
export interface ApiKeyStatus {
  name: ApiKeyName;
  configured: boolean;
}

/** The path is resolved in Rust. */
export async function revealLogFile(): Promise<void> {
  return invoke("reveal_log_file");
}

export async function listApiKeys(): Promise<ApiKeyStatus[]> {
  return invoke<ApiKeyStatus[]>("list_api_keys");
}

export async function setApiKey(name: ApiKeyName, value: string): Promise<ApiKeyStatus> {
  return invoke<ApiKeyStatus>("set_api_key", { name, value });
}

/** The stored key, only on an explicit reveal press. `null` for no key or a
 * refused keychain read. */
export async function revealApiKey(name: ApiKeyName): Promise<string | null> {
  return invoke<string | null>("reveal_api_key", { name });
}

export interface KeyCheck {
  valid: boolean;
  reason: string | null;
}

/** Omit `key` to test the stored one (the front never holds it). */
export async function checkApiKey(name: ApiKeyName, key?: string): Promise<KeyCheck> {
  if (name !== "acoustid") throw new Error(`no check for ${name}`);
  return invoke<KeyCheck>("check_acoustid_key", { key });
}

/** In display order. */
export const SERVICE_NAMES = ["musicbrainz", "acoustid", "coverart", "lastfm", "lrclib", "lyricsovh"] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export type ServiceState = "up" | "down" | "unreachable";

export interface ServiceStatus {
  name: ServiceName;
  state: ServiceState;
  /** HTTP status or exception class, shown on failure only. */
  detail: string | null;
}

export async function checkServices(only?: ServiceName): Promise<ServiceStatus[]> {
  const reply = await invoke<{ services: ServiceStatus[] }>("check_services", { only });
  return reply.services;
}

export interface LibraryLocation {
  path: string;
  defaultPath: string;
  isDefault: boolean;
}

/** Mirrors `library_move::Refusal`. */
export type MoveRefusal = "sameLocation" | "intoItself" | "insideAppData" | "occupied" | "notWritable" | "busy";

export interface MoveCheck {
  target: string;
  refusal: MoveRefusal | null;
  fileCount: number;
  sizeBytes: number;
  /** Same volume: instant rename; otherwise a full copy. */
  sameVolume: boolean;
}

export interface MoveProgress {
  copied: number;
  total: number;
}

/** Pushed during a cross-volume copy. */
export const MOVE_PROGRESS_EVENT = "library-move-progress";

export async function getLibraryLocation(): Promise<LibraryLocation> {
  return invoke<LibraryLocation>("get_library_location");
}

export async function checkLibraryMove(parent: string): Promise<MoveCheck> {
  return invoke<MoveCheck>("check_library_move", { parent });
}

export async function moveLibrary(parent: string): Promise<LibraryLocation> {
  return invoke<LibraryLocation>("move_library", { parent });
}

/** Erases music, index, history, key and preferences; keeps the rebuildable engine. */
export async function eraseAllData(): Promise<void> {
  await invoke("erase_all_data");
}

/** Removes the Python engine and tools; no user data. */
export async function reinstallEnvironment(): Promise<void> {
  await invoke("reinstall_environment");
}

/** Music and index only; artist images, playlists (emptied) and histories stay. */
export async function eraseLibrary(): Promise<void> {
  await invoke("erase_library");
}

/** Files and rows; generated avatars take over. */
export async function eraseArtistImages(): Promise<void> {
  await invoke("erase_artist_images");
}

/** Rows, covers and M3U8 mirror; the music stays. */
export async function erasePlaylists(): Promise<void> {
  await invoke("erase_playlists");
}

/** Finished downloads and the import archive (same command as the history page). */
export async function eraseHistory(): Promise<void> {
  await invoke("clear_job_history");
}

/** The only tunable delay; the AcoustID and Last.fm ones are fixed. */
export type RateLimitKey = "download";

export interface Preferences {
  lastfmFetchDelaySeconds: number;
  acoustidLookupDelaySeconds: number;
  downloadDelaySeconds: number;
  /** See `audioFormats.ts`; the backend resets unknown values to the default. */
  audioFormat: AudioFormat;
}

export async function getPreferences(): Promise<Preferences> {
  return invoke<Preferences>("get_preferences");
}

export async function setRateLimitDelay(key: RateLimitKey, seconds: number): Promise<Preferences> {
  return invoke<Preferences>("set_rate_limit_delay", { key, seconds });
}

/** Affects future downloads only. */
export async function setAudioFormat(format: AudioFormat): Promise<Preferences> {
  return invoke<Preferences>("set_audio_format", { format });
}

/** Re-encodes the whole library, deleting each original once replaced. */
export interface ConvertReport {
  format: AudioFormat;
  /** Files not already in the target format. */
  total: number;
  converted: number;
  failed: number;
  skipped: number;
}

export async function convertLibrary(): Promise<ConvertReport> {
  return invoke<ConvertReport>("convert_library");
}

/** Rebuildable parts only: the backend can't reach the library from this
 * command (see `reset.rs` and its tests). */
export interface SetupResetTargets {
  venv?: boolean;
  tools?: boolean;
  apiKeys?: boolean;
  history?: boolean;
  onboarding?: boolean;
}

export const SETUP_RESET_TARGET_NAMES = ["venv", "tools", "apiKeys", "history", "onboarding"] as const;

export type SetupResetTargetName = (typeof SETUP_RESET_TARGET_NAMES)[number];

/** Dev builds only; refused in release. */
export async function resetSetupDev(targets: SetupResetTargets): Promise<void> {
  await invoke("reset_setup_dev", { targets });
}

/** Dev builds only; refused in release. Deletes audio files. */
export async function resetLibraryDev(): Promise<void> {
  await invoke("reset_library_dev");
}

/** Applies the Appearance choice to the native window frame. Fire-and-forget:
 * a failure only leaves the frame a theme behind. */
export function setWindowTheme(choice: "light" | "dark" | "system"): void {
  try {
    void invoke("set_window_theme", { choice }).catch(() => {});
  } catch {
    // `invoke` throws synchronously without Tauri (browser preview, jsdom).
  }
}
