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
