import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

import type { Update } from "@/features/update/install";
import { installUpdate } from "@/features/update/install";

/** The running version, straight from the bundle — never a constant compiled
 * into the webview, which is exactly the value that goes stale after an update
 * installs and the app restarts. */
export function useAppVersion() {
  return useQuery({ queryKey: ["app", "version"], queryFn: getVersion, staleTime: Infinity });
}

const CHECK_KEY = ["update", "check"];

/**
 * The check, as a disabled query rather than a mutation: it still runs only
 * when someone asks — `checkForUpdate` at launch, `refetch` from the settings
 * button — never on focus or mount, so a deliberate question stays one. But
 * the answer lands in the shared cache, which is how the settings pane can
 * show the very update the launch toast announced instead of asking again.
 */
export function useUpdateCheck() {
  return useQuery({
    queryKey: CHECK_KEY,
    queryFn: () => check(),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/** The launch prompt's imperative half of `useUpdateCheck`, same cache entry. */
export function checkForUpdate(queryClient: QueryClient): Promise<Update | null> {
  return queryClient.fetchQuery({
    queryKey: CHECK_KEY,
    queryFn: () => check(),
    staleTime: Infinity,
    retry: false,
  });
}

/** No cache to invalidate on success: the app restarts. */
export function useInstallUpdate() {
  return useMutation({ mutationFn: installUpdate });
}
