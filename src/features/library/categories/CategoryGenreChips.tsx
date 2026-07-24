import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import { categoryPath } from "@/app/routes";
import type { CategoryGenre } from "@/features/library/categories/categories";

interface CategoryGenreChipsProps {
  category: string;
  genres: CategoryGenre[];
  /** null = the whole category. Comes from the route, not local state. */
  selected: string | null;
}

/** SubGenreChips' twin on the category page: the same replace-not-push
 * navigation, the active chip toggling back up, state carried through so the
 * breadcrumb keeps pointing where the page was entered from. */
export function CategoryGenreChips({ category, genres, selected }: CategoryGenreChipsProps) {
  const { t } = useTranslation("library");
  const { state } = useLocation();

  if (genres.length === 0) return null;

  const chip = (isActive: boolean) =>
    "rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
    (isActive
      ? "bg-accent text-accent-foreground"
      : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={categoryPath(category)} replace state={state} className={chip(selected == null)}>
        {t("genres.allSubs")}
      </Link>
      {genres.map((genre) => {
        const isActive = selected === genre.name;
        return (
          <Link
            key={genre.name}
            to={isActive ? categoryPath(category) : categoryPath(category, genre.name)}
            replace
            state={state}
            className={chip(isActive)}
          >
            {genre.name}
            <span className="ml-1.5 tabular-nums opacity-60">{genre.trackCount}</span>
          </Link>
        );
      })}
    </div>
  );
}
