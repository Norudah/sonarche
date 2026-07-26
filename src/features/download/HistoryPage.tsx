import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ClearHistoryDialog } from "@/features/download/ClearHistoryDialog";
import { useActiveDownloadProgress, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { Pagination } from "@/features/download/queue/Pagination";
import { pageOfJobs } from "@/features/download/queue/page";
import { QueueTable } from "@/features/download/QueueTable";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * The whole download history, paged.
 *
 * Split off the Downloads page, which is about starting a download and now
 * keeps only the last few rows: the jobs DB has no cap, so the full list is an
 * archive to consult, not something to scroll past on the way to the URL field.
 */
export function HistoryPage() {
  const { t } = useTranslation("download");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  const jobs = useJobs();

  const all = useMemo(() => jobs.data ?? [], [jobs.data]);
  // `page` comes back clamped, so a history cleared from under page 4 lands on
  // the last page that still exists instead of an empty table.
  const { jobs: visible, page, pageCount } = pageOfJobs(all, requestedPage);

  const hasHistory = all.some((job) => job.status === "done" || job.status === "failed");

  const hasActiveDownload = all.some((job) => job.status === "downloading");
  const downloadPercent = useActiveDownloadProgress(hasActiveDownload);

  const hasActiveEnrich = all.some((job) => job.status === "enriching");
  const enrichStages = useEnrichProgress(hasActiveEnrich);

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("history.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("history.lede")}</p>
        </div>
        <button
          type="button"
          onClick={() => setClearingHistory(true)}
          disabled={!hasHistory}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
          {t("queue.clearHistory")}
        </button>
      </header>

      <QueueTable jobs={visible} downloadPercent={downloadPercent} enrichStages={enrichStages} />

      <Pagination page={page} pageCount={pageCount} onChange={setRequestedPage} />

      <ClearHistoryDialog isOpen={clearingHistory} onClose={() => setClearingHistory(false)} />
    </PageContainer>
  );
}
