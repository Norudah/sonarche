import { invoke } from "@tauri-apps/api/core";

export interface PythonInfo {
  path: string;
  version: string;
}

export interface EnvStatus {
  python: PythonInfo | null;
  /** The app ships its own interpreter. */
  pythonBundled: boolean;
  venvOk: boolean;
  depsOk: boolean;
  libraryDir: string;
}

export function getEnvStatus(): Promise<EnvStatus> {
  return invoke<EnvStatus>("get_env_status");
}

export function setupEnv(): Promise<EnvStatus> {
  return invoke<EnvStatus>("setup_env");
}

/** Walkthrough state, separate from settings' `get_preferences`. */
interface OnboardingState {
  completed: boolean;
  acoustidConfigured: boolean;
}

export function getOnboardingState(): Promise<OnboardingState> {
  return invoke<OnboardingState>("get_onboarding_state");
}

export function setOnboardingCompleted(completed: boolean): Promise<OnboardingState> {
  return invoke<OnboardingState>("set_onboarding_completed", { completed });
}

/** `null` when accepted. */
export type KeyRejection = "invalidKey" | "empty";

export interface KeyCheck {
  valid: boolean;
  reason: KeyRejection | null;
}

/** Checks the key with AcoustID before anything is stored. */
export function checkAcoustidKey(key: string): Promise<KeyCheck> {
  return invoke<KeyCheck>("check_acoustid_key", { key });
}

/** Same command as Settings; an empty value clears the key. */
export function storeAcoustidKey(key: string): Promise<unknown> {
  return invoke("set_api_key", { name: "acoustid", value: key });
}
