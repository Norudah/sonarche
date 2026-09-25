import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import type { AudioFormat } from "@/features/settings/audioFormats";
import {
  type ApiKeyName,
  checkApiKey,
  checkLibraryMove,
  checkServices,
  convertLibrary,
  eraseAllData,
  eraseArtistImages,
  eraseHistory,
  eraseLibrary,
  erasePlaylists,
  getLibraryLocation,
  getPreferences,
  listApiKeys,
  moveLibrary,
  reinstallEnvironment,
  revealApiKey,
  type ServiceName,
  type RateLimitKey,
  resetLibraryDev,
  resetSetupDev,
  setApiKey,
  setAudioFormat,
  setRateLimitDelay,
  type SetupResetTargets,
} from "@/features/settings/api";

const apiKeysKey = ["settings", "apiKeys"];
const preferencesKey = ["settings", "preferences"];

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

/** A mutation so it never runs on mount (each read may prompt on macOS). */
export function useRevealApiKey() {
  return useMutation({
    mutationFn: (name: ApiKeyName) => revealApiKey(name),
  });
}

/** A mutation: a user-requested outbound request. */
export function useCheckApiKey() {
  return useMutation({
    mutationFn: ({ name, key }: { name: ApiKeyName; key?: string }) => checkApiKey(name, key),
  });
}

export function useCheckServices() {
  return useMutation({
    mutationFn: (only?: ServiceName) => checkServices(only),
  });
}

const libraryLocationKey = ["settings", "libraryLocation"];

export function useLibraryLocation() {
  return useQuery({ queryKey: libraryLocationKey, queryFn: getLibraryLocation });
}

/** Preflight for the move confirmation. */
export function useCheckLibraryMove() {
  return useMutation({ mutationFn: (parent: string) => checkLibraryMove(parent) });
}

export function useMoveLibrary() {
  return useMutation({ mutationFn: (parent: string) => moveLibrary(parent) });
}

/** Erases ending in a webview reload: nothing to invalidate. */
export function useEraseAllData() {
  return useMutation({ mutationFn: eraseAllData });
}

export function useEraseLibrary() {
  return useMutation({ mutationFn: eraseLibrary });
}

export function useReinstallEnvironment() {
  return useMutation({ mutationFn: reinstallEnvironment });
}

/** Erases the page survives: invalidate everything. */
function useEraseAndRefresh(mutationFn: () => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useEraseArtistImages() {
  return useEraseAndRefresh(eraseArtistImages);
}

export function useErasePlaylists() {
  return useEraseAndRefresh(erasePlaylists);
}

export function useEraseHistory() {
  return useEraseAndRefresh(eraseHistory);
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

export function useSetAudioFormat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (format: AudioFormat) => setAudioFormat(format),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKey });
    },
  });
}

/** Every track's path, format and bitrate change, so everything is invalidated. */
export function useConvertLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: convertLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export interface ConvertProgress {
  done: number;
  total: number;
  title: string;
  artist: string;
  failed: number;
}

/** Subscribed only while `active`. */
export function useConvertProgress(active: boolean): ConvertProgress | null {
  const [progress, setProgress] = useState<ConvertProgress | null>(null);
  const [lastActive, setLastActive] = useState(active);

  if (lastActive !== active) {
    setLastActive(active);
    setProgress(null);
  }

  useEffect(() => {
    if (!active) return;
    const unlisten = listen<{ event: string; data: Record<string, unknown> }>("sidecar:event", (event) => {
      const { event: name, data } = event.payload;
      if (name !== "convert_progress") return;
      setProgress({
        done: Number(data.done ?? 0),
        total: Number(data.total ?? 0),
        title: typeof data.title === "string" ? data.title : "",
        artist: typeof data.artist === "string" ? data.artist : "",
        failed: Number(data.failed ?? 0),
      });
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [active]);

  return progress;
}

export function useResetSetupDev() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: SetupResetTargets) => resetSetupDev(targets),
    onSuccess: () => {
      // The reset can touch the environment, onboarding flag, key and history.
      queryClient.invalidateQueries();
    },
  });
}

export function useResetLibraryDev() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetLibraryDev,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["download", "jobs"] });
    },
  });
}
