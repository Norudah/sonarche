import { toast } from "@heroui/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import { jobProgress, STAGE_WEIGHTS } from "@/features/download/activity/progress";
import { useProgressLabel } from "@/features/download/activity/useProgressLabel";
import type { DownloadJob, JobStatus } from "@/features/download/api";
import { useActiveDownloadProgress, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE } from "@/shared/toast/durations";
import { PipelineRail } from "@/shared/ui/PipelineRail";

const isRunning = (job: DownloadJob) =>
  job.status === "queued" || job.status === "downloading" || job.status === "importing" || job.status === "enriching";

function jobTitle(job: DownloadJob, fallback: string): string {
  const title = job.title ?? fallback;
  return job.artist ? `${job.artist} — ${title}` : title;
}

/** Subscribes to the job queries itself, since the toast is added only once.
 * The "view" action lives in the content: HeroUI's action slot has no room
 * beside a full-width rail. */
function LiveDownloadToast({ onView, viewLabel }: { onView: () => void; viewLabel: string }) {
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
    // Fixed width: HeroUI lays the toast out as a row, and a flexible child
    // overflows on long titles.
    <div className="flex w-60 flex-col gap-1.5 overflow-hidden">
      <p className="truncate text-[0.8125rem] font-medium text-foreground">{jobTitle(job, t("unknownArtist"))}</p>
      <PipelineRail
        fills={progress.fills}
        weights={STAGE_WEIGHTS}
        activeIndex={progress.activeIndex}
        failedIndex={null}
        tone="accent"
        label={line}
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[0.75rem] text-muted">{line}</p>
        <button
          type="button"
          onClick={onView}
          className="shrink-0 cursor-pointer text-[0.75rem] font-medium text-accent outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {viewLabel}
        </button>
      </div>
    </div>
  );
}

export function useDownloadJobToast() {
  const { t } = useTranslation("download");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const jobs = useJobs();

  // These pages already show the live card.
  const onJobsPage = matchPath(paths.download, pathname) != null || matchPath(paths.history, pathname) != null;
  const show = (jobs.data ?? []).some(isRunning) && !onJobsPage;

  // Refs keep the toast alive across navigations that change `navigate`'s identity.
  const navigateRef = useRef(navigate);
  const tRef = useRef(t);
  useEffect(() => {
    navigateRef.current = navigate;
    tRef.current = t;
  });

  useEffect(() => {
    if (!show) return;
    const id = toast(
      <LiveDownloadToast viewLabel={tRef.current("toast.view")} onView={() => navigateRef.current(paths.download)} />,
      { timeout: 0, isLoading: true },
    );
    return () => toast.close(id);
  }, [show]);

  // Announce the outcome when it lands off the jobs pages.
  const seen = useRef(new Map<string, JobStatus>());
  useEffect(() => {
    const before = seen.current;
    seen.current = new Map((jobs.data ?? []).map((job) => [job.id, job.status]));
    if (onJobsPage) return;
    for (const job of jobs.data ?? []) {
      const was = before.get(job.id);
      if (was == null || was === job.status) continue;
      const title = jobTitle(job, tRef.current("unknownArtist"));
      if (job.status === "done") {
        toast.success(tRef.current("toast.done"), { description: title, timeout: TOAST_GLANCE });
      } else if (job.status === "failed") {
        toast.danger(tRef.current("toast.failed"), { description: title, timeout: TOAST_EXPLAINED });
      }
    }
  }, [jobs.data, onJobsPage]);
}
