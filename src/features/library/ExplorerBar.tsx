import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SearchField } from "@/features/library/tracks/SearchField";

interface ExplorerBarProps {
  /** The page's own controls, left to right — sort, facet menus, a filter
   * panel. A slot rather than props: what goes here differs per shelf, and the
   * bar has no business knowing which. */
  children?: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  /** How many items the filters and the search leave. */
  shown: number;
  /** How many there are without them. The count only shows when the two differ:
   * unfiltered, it repeats the number the title block already carries. */
  total: number;
}

/**
 * The work bar every explorer wears: what to narrow by, and what to look for.
 *
 * Search used to sit at the top right of each title row, which is the standard
 * place for it — on a page of a few dozen cards. It stops working on a list of
 * thousands: the title row scrolls away and takes the search field with it,
 * while the thing being searched stays. So the controls move down into a bar of
 * their own that sticks to the top of the scrollport, and the title row goes
 * back to being a title.
 *
 * Sticky and in the flow rather than in `PageContainer`'s overlay slot: it has
 * to scroll with the page until it reaches the top, and the negative margins
 * give it the full bleed the slot exists to provide. `z-10` keeps it under the
 * detail pages' own sticky bars (`z-20`), which are never on screen with it.
 *
 * The fade below is a gradient, not a rule: pinned, the rows have to read as
 * sliding *under* the bar, and a hairline would draw a permanent line across the
 * page even at the top where there is nothing to separate. Over the page
 * background it is invisible until something scrolls into it.
 */
export function ExplorerBar({ children, query, onQueryChange, shown, total }: ExplorerBarProps) {
  const { t } = useTranslation("library");

  return (
    <div
      className={
        "sticky top-0 z-10 -mx-8 -my-1 flex flex-wrap items-center gap-2 bg-background px-8 py-3 " +
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 " +
        "after:bg-gradient-to-b after:from-background after:to-transparent"
      }
    >
      {children}

      {shown !== total && (
        <span className="text-[0.8125rem] text-muted tabular-nums">{t("filters.subset", { shown, total })}</span>
      )}

      <div className="ml-auto">
        <SearchField value={query} onChange={onQueryChange} />
      </div>
    </div>
  );
}
