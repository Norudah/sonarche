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

/** Dev builds only — the backend refuses it in release. */
export async function resetLibraryDev(): Promise<void> {
  await invoke("reset_library_dev");
}
