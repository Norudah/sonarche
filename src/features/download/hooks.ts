import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import {
  type DownloadJob,
  enqueueDownload,
  listJobs,
  mapJob,
  retryJob,
  type WireJob,
} from "@/features/download/api";
import { libraryKey } from "@/features/library/hooks";

export const jobsKey = ["download", "jobs"];

function upsertJob(queryClient: QueryClient, job: DownloadJob) {
  queryClient.setQueryData<DownloadJob[]>(jobsKey, (prev) => {
    const others = (prev ?? []).filter((j) => j.id !== job.id);
    return [job, ...others].sort((a, b) => b.createdAt - a.createdAt);
  });
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
      if (job.status === "done") {
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
    mutationFn: enqueueDownload,
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

/** Download percentage of the currently active job. The queue is strictly
 * sequential, so at most one job is downloading at a time. */
export function useActiveDownloadProgress(active: boolean) {
  const [percent, setPercent] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setPercent(null);
    const unlisten = listen<{ event: string; data: { percent?: number | null } }>(
      "sidecar:event",
      (event) => {
        if (event.payload.event !== "download_progress") return;
        setPercent(event.payload.data.percent ?? null);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active]);
  return percent;
}
