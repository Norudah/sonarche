import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const STEP =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-30";

/**
 * Prev/next with the page count between them — no numbered pages.
 *
 * The history is read backwards from the newest row, so "which page am I on"
 * is the only question a reader has here; jumping to page 7 of an undated list
 * answers nothing. Renders nothing at all on a single page rather than showing
 * two dead arrows.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation("download");
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className={STEP}
        aria-label={t("queue.previousPage")}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1 text-[0.8125rem] tabular-nums text-muted">{t("queue.pageOf", { page, pageCount })}</span>
      <button
        type="button"
        className={STEP}
        aria-label={t("queue.nextPage")}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
