import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useImports } from "@/features/import/hooks";
import { ImportHistoryCard } from "@/features/import/ImportHistoryCard";
import { pageWindow } from "@/shared/lib/pagination";
import { Pagination } from "@/shared/ui/Pagination";

/** Client-side paging: imports are few. */
const PAGE_SIZE = 10;

/** Imports on the history page, in their own section (rare, and not counted
 * in the downloads' pagination). Renders nothing when empty. */
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
