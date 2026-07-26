import { Alert } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { QueueTable } from "@/features/download/QueueTable";
import { useActiveDownloadProgress, useEnqueueDownload, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { RECENT_JOBS } from "@/features/download/queue/page";
import { UrlComposer } from "@/features/download/UrlComposer";
import { PageContainer } from "@/shared/ui/PageContainer";

export function DownloadPage() {
  const { t } = useTranslation("download");
  // Bumped on success so the composer clears its own input state.
  const [queuedCount, setQueuedCount] = useState(0);
  const jobs = useJobs();
  const enqueue = useEnqueueDownload();

  const all = jobs.data ?? [];
  // The last few only: this page is the URL field, and an unbounded archive
  // under it buried the one control it exists for. History owns the rest.
  const recent = all.slice(0, RECENT_JOBS);

  const hasActiveDownload = all.some((job) => job.status === "downloading");
  const downloadPercent = useActiveDownloadProgress(hasActiveDownload);

  const hasActiveEnrich = all.some((job) => job.status === "enriching");
  const enrichStages = useEnrichProgress(hasActiveEnrich);

  return (
    <PageContainer>
      <UrlComposer
        isPending={enqueue.isPending}
        resetToken={queuedCount}
        onSubmit={(url, kind) =>
          enqueue.mutate({ url, kind }, { onSuccess: () => setQueuedCount((count) => count + 1) })
        }
      />

      {enqueue.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("enqueueFailed")}</Alert.Title>
            <Alert.Description>{String(enqueue.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t("queue.recentHeading")}</h2>
          {/* Only once there is more than what fits here — an empty page
              behind the link would be a dead end. */}
          {all.length > RECENT_JOBS && (
            <Link
              to={paths.history}
              className="group/all flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 outline-none transition-colors hover:text-accent/80 focus-visible:underline"
            >
              {t("queue.seeAll")}
              <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover/all:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          )}
        </div>
        <QueueTable jobs={recent} downloadPercent={downloadPercent} enrichStages={enrichStages} />
      </section>
    </PageContainer>
  );
}
