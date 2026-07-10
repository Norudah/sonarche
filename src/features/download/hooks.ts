import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { downloadTrack, importTrack } from "@/features/download/api";
import { libraryKey } from "@/features/library/hooks";

export interface DownloadProgress {
  percent: number | null;
  speed: number | null;
  eta: number | null;
}

interface SidecarEventPayload {
  event: string;
  data: {
    percent?: number | null;
    speed?: number | null;
    eta?: number | null;
  };
}

export function useDownloadTrack() {
  return useMutation({ mutationFn: downloadTrack });
}

export function useImportTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

/** Follows sidecar download progress events while a download runs. */
export function useDownloadProgress(active: boolean) {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  useEffect(() => {
    if (!active) return;
    setProgress(null);
    const unlisten = listen<SidecarEventPayload>("sidecar:event", (event) => {
      if (event.payload.event !== "download_progress") return;
      const data = event.payload.data;
      setProgress({
        percent: data.percent ?? null,
        speed: data.speed ?? null,
        eta: data.eta ?? null,
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active]);
  return progress;
}
