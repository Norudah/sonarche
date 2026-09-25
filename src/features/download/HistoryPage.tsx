import { ArrowRight, History, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { JobDeck, type JobSection } from "@/features/download/activity/JobDeck";
import { ClearHistoryDialog } from "@/features/download/ClearHistoryDialog";
import { useActiveDownloadProgress, useEnrichProgress, useJobsPage } from "@/features/download/hooks";
import { HISTORY_PAGE_SIZE } from "@/features/download/queue/page";
import { pageWindow } from "@/shared/lib/pagination";
import { ActionButton, ActionLink } from "@/shared/ui/ActionLink";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";
import { Pagination } from "@/shared/ui/Pagination";

interface HistoryPageProps {
  /** Other arrivals (library imports), composed by the shell since features
   * can't import each other (see `app/routes.tsx`). */
  arrivals?: ReactNode;
  /** The clear button also sweeps these. */
  arrivalsCount?: number;
  /** Lets the shell drop the arrivals' cache after clearing. */
  onHistoryCleared?: () => void;
}

/** The full download archive, paged, with the same cards as the Downloads page. */
export function HistoryPage({ arrivals, arrivalsCount = 0, onHistoryCleared }: HistoryPageProps) {
  const { t } = useTranslation("download");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  // Fetched one page at a time.
  const jobsPage = useJobsPage(requestedPage);

  const visible = useMemo(() => jobsPage.data?.jobs ?? [], [jobsPage.data]);
  // Clamped: clearing from page 4 lands on the last page that exists.
  const { page, pageCount } = pageWindow(requestedPage, jobsPage.data?.total ?? 0, HISTORY_PAGE_SIZE);
  if (requestedPage !== page) setRequestedPage(page);

  const terminalCount = jobsPage.data?.terminalTotal ?? 0;
  const hasHistory = terminalCount > 0 || arrivalsCount > 0;

  // A running job can only be on the first page (newest first).
  const downloadPercent = useActiveDownloadProgress(visible.some((job) => job.status === "downloading"));
  const enrichStages = useEnrichProgress(visible.some((job) => job.status === "enriching"));

  const sections: JobSection[] = useMemo(
    () => [
      {
        key: "history",
        heading: t("history.heading"),
        jobs: visible,
        onTray: true,
        empty: (
          <EmptyState
            icon={History}
            title={t("history.empty.title")}
            body={t("history.empty.body")}
            action={
              <ActionLink to={paths.download} trailingIcon={ArrowRight}>
                {t("history.emptyAction")}
              </ActionLink>
            }
          />
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
        <ActionButton icon={Trash2} tone="danger" isDisabled={!hasHistory} onPress={() => setClearingHistory(true)}>
          {t("queue.clearHistory")}
        </ActionButton>
      </header>

      {arrivals}

      <JobDeck sections={sections} downloadPercent={downloadPercent} enrichStages={enrichStages} />

      <Pagination page={page} pageCount={pageCount} onChange={setRequestedPage} />

      <ClearHistoryDialog
        isOpen={clearingHistory}
        onClose={() => setClearingHistory(false)}
        downloads={terminalCount}
        imports={arrivalsCount}
        onCleared={onHistoryCleared}
      />
    </PageContainer>
  );
}
