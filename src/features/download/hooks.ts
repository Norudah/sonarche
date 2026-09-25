import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  cancelJob,
  changeJobDestination,
  clearJobHistory,
  type DownloadJob,
  type DownloadUndoOutcome,
  type DownloadUndoPreview,
  type EnqueueRequest,
  enqueueDownload,
  type ForcedAlbum,
  listJobs,
  listJobsPage,
  mapJob,
  previewDownloadUndo,
  retryJob,
  undoDownload,
  type WireJob,
} from "@/features/download/api";
import { HISTORY_PAGE_SIZE } from "@/features/download/queue/page";
import { libraryKey } from "@/features/library/hooks";

const jobsKey = ["download", "jobs"];
/** Invalidated as a whole: one transition can move rows across pages. */
const jobsPagesKey = ["download", "jobs-pages"];

function upsertJob(queryClient: QueryClient, job: DownloadJob) {
  queryClient.setQueryData<DownloadJob[]>(jobsKey, (prev) => {
    const others = (prev ?? []).filter((j) => j.id !== job.id);
    return [job, ...others].sort((a, b) => b.createdAt - a.createdAt);
  });
  queryClient.invalidateQueries({ queryKey: jobsPagesKey });
}

/** Kept live by the backend's `jobs:updated` events. */
export function useJobs() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: jobsKey, queryFn: listJobs });

  // The Rust worker owns job state; the cache mirrors its events.
  useEffect(() => {
    const unlisten = listen<WireJob>("jobs:updated", (event) => {
      const job = mapJob(event.payload);
      upsertJob(queryClient, job);
      // A cancelled album may already have filed some tracks.
      if (job.status === "done" || job.status === "cancelled") {
        queryClient.invalidateQueries({ queryKey: libraryKey });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  return query;
}

/** One archive page. Events invalidate the page queries; the previous page
 * stays shown while the next loads. */
export function useJobsPage(page: number, size = HISTORY_PAGE_SIZE) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...jobsPagesKey, page, size],
    queryFn: () => listJobsPage((page - 1) * size, size),
    placeholderData: keepPreviousData,
  });

  // The history page doesn't mount `useJobs`, so refresh the library here too.
  useEffect(() => {
    const unlisten = listen<WireJob>("jobs:updated", (event) => {
      queryClient.invalidateQueries({ queryKey: jobsPagesKey });
      const status = event.payload.status;
      if (status === "done" || status === "cancelled") {
        queryClient.invalidateQueries({ queryKey: libraryKey });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  return query;
}

export function useEnqueueDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: EnqueueRequest) => enqueueDownload(request),
    onSuccess: (job) => upsertJob(queryClient, job),
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryJob,
    onSuccess: (job) => upsertJob(queryClient, job),
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelJob,
    onSuccess: (job) => upsertJob(queryClient, job),
  });
}

/** Fetched only while the confirmation is open, so the count is fresh. */
export function useDownloadUndoPreview(id: string, enabled: boolean) {
  return useQuery<DownloadUndoPreview>({
    queryKey: ["download-undo-preview", id],
    queryFn: () => previewDownloadUndo(id),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

/** Invalidates everything: tracks, albums, covers and playlists all change. */
export function useUndoDownload() {
  const queryClient = useQueryClient();
  return useMutation<DownloadUndoOutcome, unknown, string>({
    mutationFn: (id) => undoDownload(id),
    onSettled: () => queryClient.invalidateQueries(),
  });
}

export function useChangeJobDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, forcedAlbum }: { id: string; forcedAlbum: ForcedAlbum }) =>
      changeJobDestination(id, forcedAlbum),
    onSuccess: (job) => upsertJob(queryClient, job),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

/** Clears finished jobs; running jobs stay. */
export function useClearJobHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearJobHistory,
    onSuccess: (jobs) => {
      queryClient.setQueryData(jobsKey, jobs);
      queryClient.invalidateQueries({ queryKey: jobsPagesKey });
    },
  });
}

export type EnrichStage = "fingerprint" | "lookup" | "match" | "apply" | "track_done";

/** Per-item enrich stage of the job being identified, so album rows update
 * one by one. */
export function useEnrichProgress(active: boolean) {
  const [stages, setStages] = useState<Record<number, EnrichStage>>({});
  useEffect(() => {
    if (!active) return;
    setStages({});
    const unlisten = listen<{ event: string; data: { stage?: EnrichStage; item_id?: number } }>(
      "sidecar:event",
      (event) => {
        if (event.payload.event !== "enrich_progress") return;
        const { stage, item_id: itemId } = event.payload.data;
        if (stage == null || itemId == null) return;
        setStages((prev) => ({ ...prev, [itemId]: stage }));
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active]);
  return stages;
}

/** Download percentage of the active job (the queue is sequential). */
export function useActiveDownloadProgress(active: boolean) {
  const [percent, setPercent] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setPercent(null);
    const unlisten = listen<{ event: string; data: { percent?: number | null } }>("sidecar:event", (event) => {
      if (event.payload.event !== "download_progress") return;
      setPercent(event.payload.data.percent ?? null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active]);
  return percent;
}
