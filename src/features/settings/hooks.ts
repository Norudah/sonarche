import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ApiKeyName, listApiKeys, setApiKey } from "@/features/settings/api";

export const apiKeysKey = ["settings", "apiKeys"];

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
