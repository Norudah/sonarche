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
