import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const STEP =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-30";

/** Prev/next with a page count; renders nothing for a single page. */
export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation("common");
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className={STEP}
        aria-label={t("pagination.previous")}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1 text-[0.8125rem] tabular-nums text-muted">
        {t("pagination.pageOf", { page, pageCount })}
      </span>
      <button
        type="button"
        className={STEP}
        aria-label={t("pagination.next")}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
