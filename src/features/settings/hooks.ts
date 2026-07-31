import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ApiKeyName,
  checkApiKey,
  checkLibraryMove,
  checkServices,
  eraseAllData,
  getLibraryLocation,
  getPreferences,
  listApiKeys,
  moveLibrary,
  reinstallEnvironment,
  type ServiceName,
  type RateLimitKey,
  resetLibraryDev,
  resetSetupDev,
  setApiKey,
  setRateLimitDelay,
  type SetupResetTargets,
} from "@/features/settings/api";

export const apiKeysKey = ["settings", "apiKeys"];
export const preferencesKey = ["settings", "preferences"];

export function useApiKeys() {
  return useQuery({ queryKey: apiKeysKey, queryFn: listApiKeys });
}

export function useSetApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: ApiKeyName; value: string }) => setApiKey(name, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysKey });
    },
  });
}

/** A mutation and not a query: a key check is an outbound request the user
 * asked for, never something to run because a screen mounted. */
export function useCheckApiKey() {
  return useMutation({
    mutationFn: ({ name, key }: { name: ApiKeyName; key?: string }) => checkApiKey(name, key),
  });
}

/** Same reasoning, and more so: this one wakes six services at once. */
export function useCheckServices() {
  return useMutation({
    mutationFn: (only?: ServiceName) => checkServices(only),
  });
}

export const libraryLocationKey = ["settings", "libraryLocation"];

export function useLibraryLocation() {
  return useQuery({ queryKey: libraryLocationKey, queryFn: getLibraryLocation });
}

/** The preflight behind the move confirmation: what would travel, and whether
 * anything stands in the way. */
export function useCheckLibraryMove() {
  return useMutation({ mutationFn: (parent: string) => checkLibraryMove(parent) });
}

export function useMoveLibrary() {
  return useMutation({ mutationFn: (parent: string) => moveLibrary(parent) });
}

/**
 * The two danger-zone resets.
 *
 * Neither invalidates anything on success, and that is deliberate: both end
 * with the app relaunching, so refreshing a cache that is about to be thrown
 * away would only give the dying window one last render of an empty library.
 */
export function useEraseAllData() {
  return useMutation({ mutationFn: eraseAllData });
}

export function useReinstallEnvironment() {
  return useMutation({ mutationFn: reinstallEnvironment });
}

export function usePreferences() {
  return useQuery({ queryKey: preferencesKey, queryFn: getPreferences });
}

export function useSetRateLimitDelay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, seconds }: { key: RateLimitKey; seconds: number }) => setRateLimitDelay(key, seconds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKey });
    },
  });
}

export function useResetSetupDev() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: SetupResetTargets) => resetSetupDev(targets),
    onSuccess: () => {
      // A blanket invalidation rather than a list of keys: the reset can move
      // the environment, the walkthrough flag, the stored key and the history
      // in one go, and enumerating them here would mean reaching into other
      // features for their query keys just to keep the list in sync.
      queryClient.invalidateQueries();
    },
  });
}

export function useResetLibraryDev() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetLibraryDev,
    onSuccess: () => {
      // Everything derived from the library is stale after a wipe.
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["download", "jobs"] });
    },
  });
}
