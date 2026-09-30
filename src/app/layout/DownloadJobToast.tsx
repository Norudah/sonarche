import { toast } from "@heroui/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation } from "react-router";

import { JobToastCard, usePinnedJobToast } from "@/app/layout/jobToast";
import { paths } from "@/app/routes";
import { jobProgress, STAGE_WEIGHTS } from "@/features/download/activity/progress";
import { useProgressLabel } from "@/features/download/activity/useProgressLabel";
import type { DownloadJob, JobStatus } from "@/features/download/api";
import { useActiveDownloadProgress, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";

const isRunning = (job: DownloadJob) =>
  job.status === "queued" || job.status === "downloading" || job.status === "importing" || job.status === "enriching";

function jobTitle(job: DownloadJob, fallback: string): string {
  const title = job.title ?? fallback;
  return job.artist ? `${job.artist} — ${title}` : title;
}

/** Subscribes to the job queries itself, since the toast is added only once. */
function LiveDownloadToast({ onView }: { onView: () => void }) {
  const { t } = useTranslation("download");
  const labelOf = useProgressLabel();
  const jobs = useJobs();

  const running = (jobs.data ?? []).filter(isRunning);
  // The worker is sequential; the list is newest-first, so the fallback is the oldest.
  const job = running.find((candidate) => candidate.status !== "queued") ?? running[running.length - 1] ?? null;
  const downloadPercent = useActiveDownloadProgress(job?.status === "downloading");
  const enrichStages = useEnrichProgress(job?.status === "enriching");

  if (!job) return null;

  const enrichedCount =
    job.status === "enriching"
      ? job.tracks.filter((track) => track.itemId != null && enrichStages[track.itemId] === "track_done").length
      : null;
  const progress = jobProgress(job, downloadPercent, enrichedCount);
  const waiting = running.length - 1;
  const line = waiting > 0 ? `${labelOf(progress)} · ${t("toast.more", { count: waiting })}` : labelOf(progress);

  return (
    <JobToastCard
      title={jobTitle(job, t("unknownArtist"))}
      fills={progress.fills}
      weights={STAGE_WEIGHTS}
      activeIndex={progress.activeIndex}
      line={line}
      viewLabel={t("toast.view")}
      onView={onView}
    />
  );
}

export function useDownloadJobToast() {
  const { t } = useTranslation("download");
  const { pathname } = useLocation();
  const jobs = useJobs();

  // These pages already show the live card.
  const onJobsPage = matchPath(paths.download, pathname) != null || matchPath(paths.history, pathname) != null;
  const show = (jobs.data ?? []).some(isRunning) && !onJobsPage;

  usePinnedJobToast(show, paths.download, LiveDownloadToast);

  // Announce the outcome when it lands off the jobs pages.
  const seen = useRef(new Map<string, JobStatus>());
  useEffect(() => {
    const before = seen.current;
    seen.current = new Map((jobs.data ?? []).map((job) => [job.id, job.status]));
    if (onJobsPage) return;
    for (const job of jobs.data ?? []) {
      const was = before.get(job.id);
      if (was == null || was === job.status) continue;
      const title = jobTitle(job, t("unknownArtist"));
      if (job.status === "done") {
        toast.success(t("toast.done"), { description: title, timeout: TOAST_GLANCE });
      } else if (job.status === "failed") {
        toast.danger(t("toast.failed"), { description: title, timeout: TOAST_EXPLAINED });
      }
    }
  }, [jobs.data, onJobsPage, t]);
}
