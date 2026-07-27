import { Inbox, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { JobDeck, type JobSection } from "@/features/download/activity/JobDeck";
import { ClearHistoryDialog } from "@/features/download/ClearHistoryDialog";
import { useActiveDownloadProgress, useEnrichProgress, useJobs } from "@/features/download/hooks";
import { Pagination } from "@/features/download/queue/Pagination";
import { pageOfJobs } from "@/features/download/queue/page";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * The whole download history, paged.
 *
 * Split off the Downloads page, which is about starting a download and keeps
 * only the last few: the jobs DB has no cap, so the full list is an archive to
 * consult, not something to scroll past on the way to the URL field.
 *
 * Same cards as that page, not a table. This was the app's last spreadsheet —
 * a grid of five technical columns in an interface whose language everywhere
 * else is a row with a cover, a name and one verdict. Depth did not disappear
 * with the columns: it moved into each row's own panel, where it is read on
 * demand rather than spread across every row at once.
 */
export function HistoryPage() {
  const { t } = useTranslation("download");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  const jobs = useJobs();

  const all = useMemo(() => jobs.data ?? [], [jobs.data]);
  // `page` comes back clamped, so a history cleared from under page 4 lands on
  // the last page that still exists instead of an empty list.
  const { jobs: visible, page, pageCount } = pageOfJobs(all, requestedPage);

  const hasHistory = all.some((job) => job.status === "done" || job.status === "failed");

  const downloadPercent = useActiveDownloadProgress(all.some((job) => job.status === "downloading"));
  const enrichStages = useEnrichProgress(all.some((job) => job.status === "enriching"));

  // One list, no sections: this page is the archive in one order, newest first.
  const sections: JobSection[] = useMemo(
    () => [
      {
        key: "history",
        jobs: visible,
        onTray: true,
        empty: (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-tray py-16 text-center">
            <Inbox className="size-6 text-muted/50" />
            <p className="text-sm font-medium">{t("history.empty")}</p>
          </div>
        ),
      },
    ],
    [visible, t],
  );

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

      <JobDeck sections={sections} downloadPercent={downloadPercent} enrichStages={enrichStages} />

      <Pagination page={page} pageCount={pageCount} onChange={setRequestedPage} />

      <ClearHistoryDialog isOpen={clearingHistory} onClose={() => setClearingHistory(false)} />
    </PageContainer>
  );
}
