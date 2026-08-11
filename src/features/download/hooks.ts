import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  cancelJob,
  clearJobHistory,
  type DownloadJob,
  type EnqueueRequest,
  enqueueDownload,
  listJobs,
  listJobsPage,
  mapJob,
  retryJob,
  type WireJob,
} from "@/features/download/api";
import { HISTORY_PAGE_SIZE } from "@/features/download/queue/page";
import { libraryKey } from "@/features/library/hooks";

export const jobsKey = ["download", "jobs"];
/** Prefix of every archive-page query — invalidated wholesale, since one job
 * transition can move rows across pages. */
export const jobsPagesKey = ["download", "jobs-pages"];

function upsertJob(queryClient: QueryClient, job: DownloadJob) {
  queryClient.setQueryData<DownloadJob[]>(jobsKey, (prev) => {
    const others = (prev ?? []).filter((j) => j.id !== job.id);
    return [job, ...others].sort((a, b) => b.createdAt - a.createdAt);
  });
  queryClient.invalidateQueries({ queryKey: jobsPagesKey });
}

/** Job list, kept live by the backend's `jobs:updated` events. */
export function useJobs() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: jobsKey, queryFn: listJobs });

  // Sync with the Tauri event stream: the Rust worker owns job state and
  // broadcasts every transition; the query cache just mirrors it.
  useEffect(() => {
    const unlisten = listen<WireJob>("jobs:updated", (event) => {
      const job = mapJob(event.payload);
      upsertJob(queryClient, job);
      // Cancelled counts too: an album stopped mid-run may already have filed
      // part of its tracks into the library.
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

/**
 * One page of the whole archive, kept live the same way `useJobs` is: the
 * backend's `jobs:updated` events invalidate the page queries (a transition
 * can move rows across pages, so upserting into one page would lie), and the
 * previous page stays on screen while the next one loads.
 */
export function useJobsPage(page: number, size = HISTORY_PAGE_SIZE) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...jobsPagesKey, page, size],
    queryFn: () => listJobsPage((page - 1) * size, size),
    placeholderData: keepPreviousData,
  });

  // The history page mounts this hook without `useJobs`, so the library
  // refresh on a finishing job rides here too — invalidation is idempotent
  // when both hooks happen to listen.
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

/** Stops a queued or running job; the worker records the cancelled state and
 * the event stream carries it here. */
export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelJob,
    onSuccess: (job) => upsertJob(queryClient, job),
  });
}

/** Clears completed/failed jobs from the history; in-flight jobs are untouched. */
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

/** Per-item enrich stage of the currently enriching job, keyed by beets item
 * id. The queue is sequential, so at most one job is enriching at a time;
 * the map lets an album's child rows animate one by one instead of staying
 * mute until the album-wide request returns. */
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

/** Download percentage of the currently active job. The queue is strictly
 * sequential, so at most one job is downloading at a time. */
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
