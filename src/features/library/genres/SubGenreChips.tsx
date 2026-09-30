import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import type { SubGenre } from "@/features/library/genres/genres";
import { searchWith } from "@/features/library/queryParams";

interface SubGenreChipsProps {
  subs: SubGenre[];
  /** null = the whole family; from the route. */
  selected: string | null;
}

/** The family's genres as navigation (`?genre=` in the URL, so filters survive
 * back navigation). `replace`, not push; the active chip toggles back up. */
export function SubGenreChips({ subs, selected }: SubGenreChipsProps) {
  const { t } = useTranslation("library");
  // Only `?genre=` is this control's; other params (`?view=`) are kept.
  const [params] = useSearchParams();

  if (subs.length === 0) return null;

  const chip = (isActive: boolean) =>
    "rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
    (isActive
      ? "bg-accent text-accent-foreground"
      : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={{ search: searchWith(params, "genre", null) }} replace className={chip(selected == null)}>
        {t("genres.allSubs")}
      </Link>
      {subs.map((sub) => {
        const isActive = selected === sub.name;
        return (
          <Link
            key={sub.name}
            to={{ search: searchWith(params, "genre", isActive ? null : sub.name) }}
            replace
            className={chip(isActive)}
          >
            {sub.name}
            <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
          </Link>
        );
      })}
    </div>
  );
}
