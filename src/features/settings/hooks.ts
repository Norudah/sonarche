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
  type ServiceName,
  type RateLimitKey,
  resetLibraryDev,
  resetSetupDev,
  setApiKey,
  setAudioFormat,
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
 * The danger-zone resets that end in a webview reload.
 *
 * None of the three invalidates anything on success, and that is deliberate:
 * each ends with the app reloading, so refreshing a cache that is about to be
 * thrown away would only give the dying window one last render of an empty
 * library.
 */
export function useEraseAllData() {
  return useMutation({ mutationFn: eraseAllData });
}

export function useEraseLibrary() {
  return useMutation({ mutationFn: eraseLibrary });
}

export function useReinstallEnvironment() {
  return useMutation({ mutationFn: reinstallEnvironment });
}

/** The aimed erases the page survives: no reload, so every cache that could
 * hold the dead rows goes stale at once. Blanket invalidation for the same
 * reason as the dev reset — enumerating other features' query keys here would
 * be a list nobody keeps in sync. */
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

/**
 * Re-encode the library. A mutation, never a query: this rewrites every file on
 * disk, and nothing about a screen mounting may be able to start it.
 *
 * The blanket invalidation is not laziness — a conversion changes the path,
 * the format and the bitrate of every track, so there is no cache in the app
 * that is still true afterwards.
 */
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

/**
 * Follow the conversion while it runs.
 *
 * Subscribed only while `active`, same pattern as the align pass: the listener
 * costs nothing to attach and would otherwise sit on every settings screen for
 * a pass that runs once a year.
 */
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
