import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SearchField } from "@/features/library/tracks/SearchField";

interface ExplorerBarProps {
  /** The page's controls (sort, facets, filters). */
  children?: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  /** Items left after filters and search. */
  shown: number;
  /** The count only shows when it differs from `shown`. */
  total: number;
  /** Off on pages with their own sticky bar (the album header). */
  pinned?: boolean;
}

/**
 * Explorer controls and search, sticky to the top of the scrollport so search
 * stays reachable on long lists. `z-10` stays under the detail pages' sticky
 * bars (`z-20`). A gradient, not a rule, marks rows sliding under it.
 */
export function ExplorerBar({ children, query, onQueryChange, shown, total, pinned = true }: ExplorerBarProps) {
  const { t } = useTranslation("library");

  return (
    <div
      className={
        "-mx-8 -my-1 flex flex-wrap items-center gap-2 bg-background px-8 py-3 " +
        (pinned
          ? "sticky top-0 z-10 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 " +
            "after:bg-gradient-to-b after:from-background after:to-transparent"
          : "")
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
