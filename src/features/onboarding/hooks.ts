import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  checkAcoustidKey,
  getEnvStatus,
  getOnboardingState,
  type KeyCheck,
  setOnboardingCompleted,
  setupEnv,
  storeAcoustidKey,
} from "@/features/onboarding/api";

export const envStatusKey = ["env-status"] as const;
export const onboardingStateKey = ["onboarding-state"] as const;

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

export function useOnboardingState() {
  return useQuery({
    queryKey: onboardingStateKey,
    queryFn: getOnboardingState,
    staleTime: Infinity,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => setOnboardingCompleted(true),
    onSuccess: (state) => {
      queryClient.setQueryData(onboardingStateKey, state);
    },
  });
}

/**
 * Check the key, and store it only if AcoustID accepted it.
 *
 * One mutation rather than two so the screen can never end up in the state the
 * whole step exists to prevent: a key saved, a green check shown, and every
 * later download quietly falling back to guessed tags because of a typo.
 */
export function useSaveAcoustidKey() {
  const queryClient = useQueryClient();
  return useMutation<KeyCheck, Error, string>({
    mutationFn: async (key) => {
      const check = await checkAcoustidKey(key);
      if (check.valid) await storeAcoustidKey(key);
      return check;
    },
    onSuccess: (check) => {
      // Blanket, not by key: the stored key is read by the settings screen too,
      // and enumerating its query keys here would mean reaching across features
      // for them. During the walkthrough there is nothing else mounted to
      // refetch anyway.
      if (check.valid) queryClient.invalidateQueries();
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
