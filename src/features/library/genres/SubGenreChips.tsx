import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import { genrePath } from "@/app/routes";
import type { SubGenre } from "@/features/library/genres/genres";

interface SubGenreChipsProps {
  family: string;
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
export function SubGenreChips({ family, subs, selected }: SubGenreChipsProps) {
  const { t } = useTranslation("library");
  // Carried through untouched: replacing the entry must not rewrite where it
  // came from, or the back arrow would start pointing at this page itself.
  const { state } = useLocation();

  if (subs.length === 0) return null;

  const chip = (isActive: boolean) =>
    "rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
    (isActive
      ? "bg-accent text-accent-foreground"
      : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={genrePath(family)}
        replace
        state={state}
        className={chip(selected == null)}
      >
        {t("genres.allSubs")}
      </Link>
      {subs.map((sub) => {
        const isActive = selected === sub.name;
        return (
          <Link
            key={sub.name}
            to={isActive ? genrePath(family) : genrePath(family, sub.name)}
            replace
            state={state}
            className={chip(isActive)}
          >
            {sub.name}
            <span className="ml-1.5 tabular-nums opacity-60">
              {sub.trackCount}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
