import { invoke } from "@tauri-apps/api/core";

export type ApiKeyName = "acoustid";

/** The backend never returns the secret itself, only whether one is stored. */
export interface ApiKeyStatus {
  name: ApiKeyName;
  configured: boolean;
}

/** Reveal `sonarche.log` in the OS file manager. The path is resolved on the
 * Rust side; nothing crosses the IPC boundary. */
export async function revealLogFile(): Promise<void> {
  return invoke("reveal_log_file");
}

export async function listApiKeys(): Promise<ApiKeyStatus[]> {
  return invoke<ApiKeyStatus[]>("list_api_keys");
}

export async function setApiKey(name: ApiKeyName, value: string): Promise<ApiKeyStatus> {
  return invoke<ApiKeyStatus>("set_api_key", { name, value });
}

/** The verdict on a key: valid, or invalid with a machine-readable reason. */
export interface KeyCheck {
  valid: boolean;
  reason: string | null;
}

/** Omit `key` to test the one already stored — the frontend never holds it. */
export async function checkApiKey(name: ApiKeyName, key?: string): Promise<KeyCheck> {
  if (name !== "acoustid") throw new Error(`no check for ${name}`);
  return invoke<KeyCheck>("check_acoustid_key", { key });
}

/** The outside services the app leans on, in the order the panel lists them. */
export const SERVICE_NAMES = ["musicbrainz", "acoustid", "coverart", "lastfm", "lrclib", "lyricsovh"] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export type ServiceState = "up" | "down" | "unreachable";

export interface ServiceStatus {
  name: ServiceName;
  state: ServiceState;
  /** The HTTP status or the exception's class name — shown only on a failure,
   * where "it did not answer" alone leaves nothing to act on. */
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

/** Why a move cannot go ahead. Mirrors `library_move::Refusal`. */
export type MoveRefusal = "sameLocation" | "intoItself" | "insideAppData" | "occupied" | "notWritable" | "busy";

export interface MoveCheck {
  target: string;
  refusal: MoveRefusal | null;
  fileCount: number;
  sizeBytes: number;
  /** A rename inside one volume is instant; across volumes every byte travels. */
  sameVolume: boolean;
}

export interface MoveProgress {
  copied: number;
  total: number;
}

/** The event the backend pushes while a cross-volume copy runs. */
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

/** Destroys the music, the index, the history, the key and every preference.
 * Keeps the Python engine, which the app can rebuild and the user cannot. */
export async function eraseAllData(): Promise<void> {
  await invoke("erase_all_data");
}

/** Throws away the Python engine and the downloaded tools. Touches no user
 * data; the first-run walkthrough puts it back. */
export async function reinstallEnvironment(): Promise<void> {
  await invoke("reinstall_environment");
}

/** Destroys the music and its index only: artist images, playlists (kept,
 * emptied) and the histories all survive. */
export async function eraseLibrary(): Promise<void> {
  await invoke("erase_library");
}

/** Every artist image at once — files and index rows. Avatars take over. */
export async function eraseArtistImages(): Promise<void> {
  await invoke("erase_artist_images");
}

/** Every playlist at once — rows, covers, M3U8 mirror. The music stays. */
export async function erasePlaylists(): Promise<void> {
  await invoke("erase_playlists");
}

/** Both archives in one sweep: terminal download jobs and the import history.
 * The same command the history page's own clear button calls. */
export async function eraseHistory(): Promise<void> {
  await invoke("clear_job_history");
}

/** The one delay the user may still tune. The AcoustID and Last.fm pauses are
 * fixed server-side — their keys are shared across installs — and the backend
 * refuses writes to them. */
export type RateLimitKey = "download";

export interface Preferences {
  lastfmFetchDelaySeconds: number;
  acoustidLookupDelaySeconds: number;
  downloadDelaySeconds: number;
}

export async function getPreferences(): Promise<Preferences> {
  return invoke<Preferences>("get_preferences");
}

export async function setRateLimitDelay(key: RateLimitKey, seconds: number): Promise<Preferences> {
  return invoke<Preferences>("set_rate_limit_delay", { key, seconds });
}

/**
 * What a setup reset puts back. Everything here is rebuildable by the app —
 * the backend physically cannot reach the beets database or the audio files
 * from this command (see `dev_reset.rs` and its test).
 */
export interface SetupResetTargets {
  venv?: boolean;
  tools?: boolean;
  apiKeys?: boolean;
  history?: boolean;
  onboarding?: boolean;
}

export const SETUP_RESET_TARGET_NAMES = ["venv", "tools", "apiKeys", "history", "onboarding"] as const;

export type SetupResetTargetName = (typeof SETUP_RESET_TARGET_NAMES)[number];

/** Dev builds only — the backend refuses it in release. */
export async function resetSetupDev(targets: SetupResetTargets): Promise<void> {
  await invoke("reset_setup_dev", { targets });
}

/** Dev builds only — the backend refuses it in release. Destroys audio files. */
export async function resetLibraryDev(): Promise<void> {
  await invoke("reset_library_dev");
}

/**
 * Hands the Appearance choice to the native window frame — the traffic lights
 * and system scrollbars on macOS, the caption bar's colour on Windows.
 *
 * Fire-and-forget, and it swallows: there is no browser behind a preview and no
 * window worth taking the app down for. A frame one theme behind is a seam; an
 * unhandled rejection on boot is a bug.
 */
export function setWindowTheme(choice: "light" | "dark" | "system"): void {
  try {
    void invoke("set_window_theme", { choice }).catch(() => {});
  } catch {
    // `invoke` throws on the spot when there is no Tauri behind the webview at
    // all — a browser preview, a jsdom test — rather than rejecting.
  }
}
