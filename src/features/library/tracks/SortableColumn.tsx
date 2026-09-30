import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";

/** A sortable column header, shared by every track table. Grids use `SortSelect`. */
export function SortableColumn({
  column,
  label,
  className,
  /** Also decides the arrow slot's side, so the label stays over its values. */
  align = "left",
  sort,
  onSort,
}: {
  column: TrackSortKey;
  label: string;
  className: string;
  align?: "left" | "right";
  sort: TrackSort | null;
  onSort: (key: TrackSortKey) => void;
}) {
  const { t } = useTranslation("library");
  const isActive = sort?.key === column;
  const Arrow = sort?.dir === "desc" ? ArrowDown : ArrowUp;
  const right = align === "right";

  return (
    <th
      className={`${className} ${right ? "text-right" : "text-left"}`}
      aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {/* `uppercase` again: the UA stylesheet resets text-transform on buttons. */}
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={t("sort.byColumn", { column: label })}
        className={
          "inline-flex cursor-pointer items-center gap-1 rounded uppercase outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
          (right ? "flex-row-reverse " : "") +
          (isActive ? "text-accent" : "hover:text-foreground")
        }
      >
        {label}
        {/* Empty slot kept so the column doesn't widen when sorted. */}
        <span className="flex w-3 justify-center">{isActive && <Arrow className="size-3" />}</span>
      </button>
    </th>
  );
}
