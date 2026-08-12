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
  /** Which edge the label hugs, and so which side the arrow's slot sits on.
   * Stated here rather than as a `text-*` in `className` because the two cannot
   * be decided separately: a right-aligned label with its slot still on the
   * right is pushed 12px off the values it names. */
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
      // The live ordering for a screen reader, which cannot see the arrow.
      aria-sort={isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {/* `uppercase` is repeated here on purpose: the UA stylesheet resets
       * `text-transform` on form elements, so the one on the `th` reaches every
       * plain header and none of the sortable ones — which is why half this row
       * used to shout and the other half not. */}
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
        {/* The slot is held empty so a column does not widen when it becomes the
         * sorted one — which shifted every header to its right. Reversed above,
         * it lands on the outer side, where an empty 12px costs nothing. */}
        <span className="flex w-3 justify-center">{isActive && <Arrow className="size-3" />}</span>
      </button>
    </th>
  );
}
