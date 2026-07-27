import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ApiKeyName,
  getPreferences,
  listApiKeys,
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
