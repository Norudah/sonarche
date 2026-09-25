import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router";

import type { CategoryGenre } from "@/features/library/categories/categories";
import { searchWith } from "@/features/library/queryParams";

interface CategoryGenreChipsProps {
  genres: CategoryGenre[];
  /** null = the whole category; from the route. */
  selected: string | null;
}

/** `SubGenreChips` for the category page (`replace` navigation, toggling off). */
export function CategoryGenreChips({ genres, selected }: CategoryGenreChipsProps) {
  const { t } = useTranslation("library");
  const { state } = useLocation();
  // Owns `?genre=` only (see SubGenreChips).
  const [params] = useSearchParams();

  if (genres.length === 0) return null;

  const chip = (isActive: boolean) =>
    "rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
    (isActive
      ? "bg-accent text-accent-foreground"
      : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={{ search: searchWith(params, "genre", null) }} replace state={state} className={chip(selected == null)}>
        {t("genres.allSubs")}
      </Link>
      {genres.map((genre) => {
        const isActive = selected === genre.name;
        return (
          <Link
            key={genre.name}
            to={{ search: searchWith(params, "genre", isActive ? null : genre.name) }}
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
