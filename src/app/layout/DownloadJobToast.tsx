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

/**
 * The running download, kept in sight from any other page.
 *
 * The downloads and history pages already draw the job card; everywhere else
 * the work would be invisible until it was over. One persistent toast carries
 * the same rail and the same phase line as the card, so leaving the page never
 * means losing the thread — and it leaves with you when you come back to a
 * page that shows the real thing.
 */

const isRunning = (job: DownloadJob) =>
  job.status === "queued" || job.status === "downloading" || job.status === "importing" || job.status === "enriching";

function jobTitle(job: DownloadJob, fallback: string): string {
  const title = job.title ?? fallback;
  return job.artist ? `${job.artist} — ${title}` : title;
}

/** Lives inside the toast and keeps itself current: the toast is added once,
 * and this subscribes to the same queries and events the job card does. The
 * "view" affordance is part of the content — HeroUI's own action slot sits in
 * a row beside it, where a full-width rail leaves it no room. */
function LiveDownloadToast({ onView, viewLabel }: { onView: () => void; viewLabel: string }) {
  const { t } = useTranslation("download");
  const labelOf = useProgressLabel();
  const jobs = useJobs();

  const running = (jobs.data ?? []).filter(isRunning);
  // The worker is sequential: at most one job is past `queued` at a time. The
  // list is newest-first, so the fallback (nothing started yet) is the oldest.
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
    // Hard width rather than flex: HeroUI lays the toast out as a row around
    // this slot, and a flexible child measured against a long title overflows
    // the box. 240px leaves room for the spinner and the close button in the
    // 340px region, whatever the title says.
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

  // The two pages that already show the live card — the toast would be an echo.
  const onJobsPage = matchPath(paths.download, pathname) != null || matchPath(paths.history, pathname) != null;
  const show = (jobs.data ?? []).some(isRunning) && !onJobsPage;

  // Read through refs inside the effects: the toast must live exactly as long
  // as `show`, not be torn down and re-added because a navigation between two
  // other pages gave `navigate` a new identity.
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

  // The outcome, when it lands out of sight. On the jobs pages the card's own
  // verdict speaks; elsewhere a silent end reads as a download that vanished.
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
