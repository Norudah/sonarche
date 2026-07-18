import { Alert, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ClearHistoryDialog } from "@/features/download/ClearHistoryDialog";
import { QueueTable } from "@/features/download/QueueTable";
import {
  useActiveDownloadProgress,
  useEnqueueDownload,
  useEnrichProgress,
  useJobs,
} from "@/features/download/hooks";
import { UrlComposer } from "@/features/download/UrlComposer";
import { PageContainer } from "@/shared/ui/PageContainer";

export function DownloadPage() {
  const { t } = useTranslation("download");
  const [clearingHistory, setClearingHistory] = useState(false);
  // Bumped on success so the composer clears its own input state.
  const [queuedCount, setQueuedCount] = useState(0);
  const jobs = useJobs();
  const enqueue = useEnqueueDownload();

  const hasHistory =
    jobs.data?.some((job) => job.status === "done" || job.status === "failed") ?? false;

  const hasActiveDownload = jobs.data?.some((job) => job.status === "downloading") ?? false;
  const downloadPercent = useActiveDownloadProgress(hasActiveDownload);

  const hasActiveEnrich = jobs.data?.some((job) => job.status === "enriching") ?? false;
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
          <h2 className="text-lg font-semibold">{t("queue.heading")}</h2>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => setClearingHistory(true)}
            isDisabled={!hasHistory}
          >
            <Trash2 className="size-4" />
            {t("queue.clearHistory")}
          </Button>
        </div>
        <QueueTable
          jobs={jobs.data ?? []}
          downloadPercent={downloadPercent}
          enrichStages={enrichStages}
        />
      </section>

      <ClearHistoryDialog isOpen={clearingHistory} onClose={() => setClearingHistory(false)} />
    </PageContainer>
  );
}
