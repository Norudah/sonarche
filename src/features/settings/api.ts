import { invoke } from "@tauri-apps/api/core";

export type ApiKeyName = "acoustid";

/** The backend never returns the secret itself, only whether one is stored. */
export interface ApiKeyStatus {
  name: ApiKeyName;
  configured: boolean;
}

export async function listApiKeys(): Promise<ApiKeyStatus[]> {
  return invoke<ApiKeyStatus[]>("list_api_keys");
}

export async function setApiKey(name: ApiKeyName, value: string): Promise<ApiKeyStatus> {
  return invoke<ApiKeyStatus>("set_api_key", { name, value });
}

export type RateLimitKey = "lastfm" | "acoustid" | "download";

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
