import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { getEnvStatus, setupEnv } from "@/features/onboarding/api";

export const envStatusKey = ["env-status"] as const;

export function useEnvStatus() {
  return useQuery({
    queryKey: envStatusKey,
    queryFn: getEnvStatus,
    staleTime: Infinity,
  });
}

export function useSetupEnv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setupEnv,
    onSuccess: (status) => {
      queryClient.setQueryData(envStatusKey, status);
    },
  });
}

/** Streams `setup:log` lines from the backend while the setup runs. */
export function useSetupLogs(active: boolean) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    if (!active) return;
    setLines([]);
    const unlisten = listen<string>("setup:log", (event) => {
      setLines((prev) => [...prev.slice(-200), event.payload]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active]);
  return lines;
}
