import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TrackSort, TrackSortKey } from "@/features/library/tracks/sort";

/**
 * A column header that orders the list — shared by the library-wide table, the
 * album tracklist and the playlist, so a clickable header reads the same
 * wherever it appears.
 *
 * The control belongs to the thing it orders: a table has headers, so it sorts
 * from them, while the album and artist shelves — grids, with no headers to
 * click — keep their `SortSelect`. Two idioms, each where it is the obvious one.
 */
export function SortableColumn({
  column,
  label,
  className,
  sort,
  onSort,
}: {
  column: TrackSortKey;
  label: string;
  className: string;
  sort: TrackSort | null;
  onSort: (key: TrackSortKey) => void;
}) {
  const { t } = useTranslation("library");
  const isActive = sort?.key === column;
  const Arrow = sort?.dir === "desc" ? ArrowDown : ArrowUp;

  return (
    <th
      className={className}
      // The live ordering for a screen reader, which cannot see the arrow.
      aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={t("sort.byColumn", { column: label })}
        className={
          "inline-flex cursor-pointer items-center gap-1 rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
          (isActive ? "text-accent" : "hover:text-foreground")
        }
      >
        {label}
        {/* The slot is held empty so a column does not widen when it becomes the
         * sorted one — which shifted every header to its right. */}
        <span className="flex w-3 justify-center">{isActive && <Arrow className="size-3" />}</span>
      </button>
    </th>
  );
}
