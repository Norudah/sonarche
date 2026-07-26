import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import type { SubGenre } from "@/features/library/genres/genres";
import { searchWith } from "@/features/library/queryParams";

interface SubGenreChipsProps {
  subs: SubGenre[];
  /** null = the whole family. Comes from the route, not from local state. */
  selected: string | null;
}

/**
 * The family's genres, as navigation.
 *
 * They started as buttons holding component state, which was wrong twice over.
 * Practically: opening an album from a filtered shelf and coming back lost the
 * filter, because nothing in the history remembered it. And conceptually: a
 * genre is something the user can go *to* and inspect, not a switch on someone
 * else's page — which is the whole reason the route grew a second segment.
 *
 * Selecting the active chip again goes back up to the family, so the pair
 * stays reversible without a separate "clear" control.
 *
 * Every chip *replaces* rather than pushes. Pushing meant trying six genres in
 * a row buried the page you arrived from under six history entries, and getting
 * out took six presses of a Back button that appeared to do nothing each time.
 * Refining which genre you are looking at is one visit to this family, not six
 * places you went.
 */
export function SubGenreChips({ subs, selected }: SubGenreChipsProps) {
  const { t } = useTranslation("library");
  // Only `?genre=` is this control's to change. Rebuilding the whole query from
  // the family and the genre alone dropped `?view=`, so flipping a chip in the
  // tracks mode threw the page back to its overview.
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
