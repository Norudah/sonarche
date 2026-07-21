import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { genrePath, paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroWash } from "@/features/library/HeroWash";

/**
 * Back to wherever this page was entered from.
 *
 * There is no "back to the family" step, because selecting a genre replaces the
 * current history entry rather than pushing one — a family and its genres are
 * one visit. That is what stops eight chip flips from costing eight presses to
 * undo, and the family is anyway one click away on the "All" chip.
 *
 * `up` is the cold-entry fallback only: reached without history (a restored
 * session, a direct navigation), the crumb still has somewhere sensible to go.
 */
function GenreBreadcrumb({ family, isGenre, current }: { family: string; isGenre: boolean; current: string }) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromList = (state as { fromGenres?: boolean } | null)?.fromGenres === true;

  const up = isGenre ? genrePath(family) : paths.libraryGenres;

  return (
    <HeroBreadcrumb
      label={t("breadcrumb")}
      backLabel={t("genres.back")}
      current={current}
      onBack={() => (cameFromList ? navigate(-1) : navigate(up))}
    />
  );
}

interface GenreHeroProps {
  /** Family key — the route's first segment, and where "back" leads. */
  family: string;
  /** The family's display name. */
  familyLabel: string;
  /** The genre being inspected, or null for the family itself. */
  genre: string | null;
  albumCount: number;
  trackCount: number;
  artistCount: number;
  share: number;
  ref?: Ref<HTMLElement>;
}

/**
 * The album and artist heroes without their square.
 *
 * Every other hero in the app leads with a piece of artwork; a genre has none,
 * and inventing one — a mosaic of four covers from the family — would put a
 * third fabricated thumbnail in the app for an object that is not a thing you
 * can look at. It is text on the wash, and now that the wash is the same for
 * every hero, this one no longer has to borrow a record's cover to be tinted at
 * all.
 *
 * One component for both depths on purpose: a genre is inspected exactly the
 * way its family is, and giving it a lighter-weight band would have said it was
 * a filter rather than a subject.
 */
export function GenreHero({
  family,
  familyLabel,
  genre,
  albumCount,
  trackCount,
  artistCount,
  share,
  ref,
}: GenreHeroProps) {
  const { t } = useTranslation("library");

  // No "Genre" eyebrow: the breadcrumb one line up already reads "Genres /
  // …", so labelling the subject "Genre" again is the same word twice. A family
  // is its own top level and needs no eyebrow at all; an open genre keeps one,
  // but only to name the family it belongs to — which the breadcrumb does *not*
  // carry — with the redundant "Genre ·" prefix dropped.
  const eyebrow = genre == null ? null : familyLabel;

  const meta = [
    t("trackCount", { count: trackCount }),
    t("albumCount", { count: albumCount }),
    t("artistCount", { count: artistCount }),
    t("genres.shareOfLibrary", { percent: Math.round(share * 100) }),
  ];

  return (
    <header ref={ref} className="relative -mx-8 -mt-8 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <GenreBreadcrumb family={family} isGenre={genre != null} current={genre ?? familyLabel} />

        <div className="mt-6">
          {eyebrow && <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{eyebrow}</p>}
          <h1 className={`${eyebrow ? "mt-1" : ""} truncate text-4xl font-semibold tracking-tight`}>
            {genre ?? familyLabel}
          </h1>
          <p className="mt-2 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
        </div>
      </div>
    </header>
  );
}
