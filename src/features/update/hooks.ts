import { useMutation, useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

import { installUpdate } from "@/features/update/install";

/** The running version, straight from the bundle — never a constant compiled
 * into the webview, which is exactly the value that goes stale after an update
 * installs and the app restarts. */
export function useAppVersion() {
  return useQuery({ queryKey: ["app", "version"], queryFn: getVersion, staleTime: Infinity });
}

/**
 * The check, as a mutation rather than a query: it runs when the user presses
 * the button and at no other time. A query would refetch on focus and on mount,
 * turning a deliberate question into background polling of GitHub — which is
 * precisely what the launch prompt already decided not to do.
 */
export function useCheckForUpdate() {
  return useMutation({ mutationFn: () => check() });
}

/** No cache to invalidate on success: the app restarts. */
export function useInstallUpdate() {
  return useMutation({ mutationFn: installUpdate });
}
