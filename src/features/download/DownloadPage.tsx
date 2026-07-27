import { Alert } from "@heroui/react";
import { ArrowRight, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import type { DownloadJob } from "@/features/download/api";
import { JobDeck, type JobSection } from "@/features/download/activity/JobDeck";
import { useActiveDownloadProgress, useEnqueueDownload, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { RECENT_JOBS } from "@/features/download/queue/page";
import { UrlComposer } from "@/features/download/UrlComposer";
import { PageContainer } from "@/shared/ui/PageContainer";

const isTerminal = (job: DownloadJob) => job.status === "done" || job.status === "failed";

export function DownloadPage() {
  const { t } = useTranslation("download");
  // Bumped on success so the composer clears its own input state.
  const [queuedCount, setQueuedCount] = useState(0);
  const jobs = useJobs();
  const enqueue = useEnqueueDownload();

  const all = useMemo(() => jobs.data ?? [], [jobs.data]);

  // The worker is strictly sequential, so these two subscriptions describe the
  // one job in flight — the deck hands them to that card and to no other.
  const downloadPercent = useActiveDownloadProgress(all.some((job) => job.status === "downloading"));
  const enrichStages = useEnrichProgress(all.some((job) => job.status === "enriching"));

  /**
   * Two registers, taken from the worker's own shape: at any moment one job is
   * actually happening and a history sits behind it. A flat list gave both the
   * same weight and buried the live one among rows that will never change.
   */
  const sections: JobSection[] = useMemo(() => {
    const finished = all.filter(isTerminal);
    // Oldest first: the queue is a line, and the one being served is at its head.
    const inFlight = all.filter((job) => !isTerminal(job)).reverse();
    const recent = finished.slice(0, RECENT_JOBS);

    return [
      ...(inFlight.length > 0
        ? [{ key: "in-flight", heading: t("activity.inFlight"), jobs: inFlight, onTray: true }]
        : []),
      {
        key: "recent",
        heading: t("activity.recent"),
        jobs: recent,
        onTray: true,
        // Only once there is more than what fits here — an empty page behind
        // the link would be a dead end.
        action:
          finished.length > RECENT_JOBS ? (
            <Link
              to={paths.history}
              className="group/all flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent underline-offset-4 outline-none transition-colors hover:text-accent/80 focus-visible:underline"
            >
              {t("queue.seeAll")}
              <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover/all:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          ) : undefined,
        empty:
          inFlight.length > 0 ? null : (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-tray py-14 text-center">
              <Inbox className="size-6 text-muted/50" />
              <p className="text-sm font-medium">{t("activity.empty.title")}</p>
              <p className="max-w-xs text-[0.8125rem] text-muted">{t("activity.empty.body")}</p>
            </div>
          ),
      },
    ];
  }, [all, t]);

  return (
    <PageContainer>
      <UrlComposer
        isPending={enqueue.isPending}
        resetToken={queuedCount}
        onSubmit={(request) => enqueue.mutate(request, { onSuccess: () => setQueuedCount((count) => count + 1) })}
      />

      {enqueue.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("enqueueFailed")}</Alert.Title>
            <Alert.Description>{String(enqueue.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <JobDeck sections={sections} downloadPercent={downloadPercent} enrichStages={enrichStages} />
    </PageContainer>
  );
}
