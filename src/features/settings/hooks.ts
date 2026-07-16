import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ApiKeyName,
  getPreferences,
  listApiKeys,
  setApiKey,
  setLastfmFetchDelay,
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

export function useSetLastfmFetchDelay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setLastfmFetchDelay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKey });
    },
  });
}
