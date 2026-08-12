import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useImports } from "@/features/import/hooks";
import { ImportHistoryCard } from "@/features/import/ImportHistoryCard";
import { pageWindow } from "@/shared/lib/pagination";
import { Pagination } from "@/shared/ui/Pagination";

/** Cards per page. Client-side, unlike the downloads below: you import a few
 * times a year, so the whole archive is a short list — the pager only exists
 * so that years of history can never stack into one endless column. */
const PAGE_SIZE = 10;

/**
 * The imports on the history page.
 *
 * Its own section rather than interleaved with the downloads, for a reason that
 * is about the content and not the layout: you download all week and import
 * three times a year. Merged into one stream, an import would be a row you
 * scroll past once and never find again, and the page's pagination is counted in
 * downloads.
 *
 * Renders nothing at all when there are none. An empty state here would be a
 * second invitation on a page that already has one, on a screen the user reached
 * to look at what they have already done.
 */
export function ImportHistorySection() {
  const { t } = useTranslation("import");
  const imports = useImports();
  const [requestedPage, setRequestedPage] = useState(1);

  const records = imports.data ?? [];
  if (records.length === 0) return null;

  const { page, pageCount, start } = pageWindow(requestedPage, records.length, PAGE_SIZE);
  const visible = records.slice(start, start + PAGE_SIZE);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("history.heading")}</h2>
      <div className="flex flex-col gap-1 rounded-2xl bg-tray p-1.5">
        {visible.map((record) => (
          <ImportHistoryCard key={record.id} record={record} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={setRequestedPage} />
    </section>
  );
}
