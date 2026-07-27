import { invoke } from "@tauri-apps/api/core";

export interface PythonInfo {
  path: string;
  version: string;
}

export interface EnvStatus {
  python: PythonInfo | null;
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

/**
 * The walkthrough's own state, kept apart from the settings feature's
 * `get_preferences` on purpose: these two booleans are the only thing the
 * first-run flow needs, and asking for them here means onboarding never has to
 * reach across into settings for its own progress.
 */
export interface OnboardingState {
  completed: boolean;
  acoustidConfigured: boolean;
}

export function getOnboardingState(): Promise<OnboardingState> {
  return invoke<OnboardingState>("get_onboarding_state");
}

export function setOnboardingCompleted(completed: boolean): Promise<OnboardingState> {
  return invoke<OnboardingState>("set_onboarding_completed", { completed });
}

/** Why a key was turned down. `null` when it was accepted. */
export type KeyRejection = "invalidKey" | "empty";

export interface KeyCheck {
  valid: boolean;
  reason: KeyRejection | null;
}

/** Asks AcoustID whether it knows this key, before anything is stored. */
export function checkAcoustidKey(key: string): Promise<KeyCheck> {
  return invoke<KeyCheck>("check_acoustid_key", { key });
}

/** Same command the settings screen uses — the walkthrough is just an earlier
 * door onto it. An empty value clears the stored key. */
export function storeAcoustidKey(key: string): Promise<unknown> {
  return invoke("set_api_key", { name: "acoustid", value: key });
}
