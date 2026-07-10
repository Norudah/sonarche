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
