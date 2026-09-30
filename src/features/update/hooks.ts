import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

import type { Update } from "@/features/update/install";
import { installUpdate } from "@/features/update/install";

/** From the bundle, so it's correct after an update. */
export function useAppVersion() {
  return useQuery({ queryKey: ["app", "version"], queryFn: getVersion, staleTime: Infinity });
}

const CHECK_KEY = ["update", "check"];

/** Dev builds always lag the latest release, so they never check. */
function checkForUpdateUnlessDev(): Promise<Update | null> {
  return import.meta.env.DEV ? Promise.resolve(null) : check();
}

/** A disabled query (runs only on request) so the launch toast and Settings
 * share one cached result. */
export function useUpdateCheck() {
  return useQuery({
    queryKey: CHECK_KEY,
    queryFn: checkForUpdateUnlessDev,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/** Imperative counterpart of `useUpdateCheck`, same cache entry. */
export function checkForUpdate(queryClient: QueryClient): Promise<Update | null> {
  return queryClient.fetchQuery({
    queryKey: CHECK_KEY,
    queryFn: checkForUpdateUnlessDev,
    staleTime: Infinity,
    retry: false,
  });
}

/** Nothing to invalidate: the app restarts. */
export function useInstallUpdate() {
  return useMutation({ mutationFn: installUpdate });
}
