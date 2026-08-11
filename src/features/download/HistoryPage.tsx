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
  /**
   * The other ways music arrived, filed above the downloads.
   *
   * A slot, because this page is the archive of *everything* that entered the
   * ark while this component only knows about downloads — a library import is
   * another feature's business, and features do not import each other. The shell
   * composes the two (see `app/routes.tsx`).
   */
  arrivals?: ReactNode;
  /** How many arrivals that slot holds: the clear button sweeps them too, so it
   * must light up for them and the confirmation must count them. */
  arrivalsCount?: number;
  /** Called once the sweep succeeded, so the shell can drop the arrivals'
   * cache — this component only knows its own. */
  onHistoryCleared?: () => void;
}

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
export function HistoryPage({ arrivals, arrivalsCount = 0, onHistoryCleared }: HistoryPageProps) {
  const { t } = useTranslation("download");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [requestedPage, setRequestedPage] = useState(1);
  // The archive stays in the store and comes over one page at a time — the
  // full list used to ride into memory on every launch, tracks and all.
  const jobsPage = useJobsPage(requestedPage);

  const visible = useMemo(() => jobsPage.data?.jobs ?? [], [jobsPage.data]);
  // Clamped against the server's total, so a history cleared from under page 4
  // lands on the last page that still exists instead of an empty list.
  const { page, pageCount } = pageWindow(requestedPage, jobsPage.data?.total ?? 0, HISTORY_PAGE_SIZE);
  if (requestedPage !== page) setRequestedPage(page);

  const terminalCount = jobsPage.data?.terminalTotal ?? 0;
  const hasHistory = terminalCount > 0 || arrivalsCount > 0;

  // The worker is sequential and the archive is newest-first, so a job in
  // flight can only sit on the first page — where these subscriptions find it.
  const downloadPercent = useActiveDownloadProgress(visible.some((job) => job.status === "downloading"));
  const enrichStages = useEnrichProgress(visible.some((job) => job.status === "enriching"));

  // Named now that it is not the only thing on the page: a library import files
  // its own section above, and two unlabelled stacks of rows would read as one
  // list that changes shape half way down.
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
        <ActionButton icon={Trash2} tone="muted" isDisabled={!hasHistory} onPress={() => setClearingHistory(true)}>
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
