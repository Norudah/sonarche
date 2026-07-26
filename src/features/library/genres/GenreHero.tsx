import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";

import { genrePath, paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";

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
  onPlay: () => void;
  onShuffle: () => void;
  /** The view switcher, at the right end of the breadcrumb line. Every detail
   * hero puts it there, so the control never moves between subjects. */
  actions?: ReactNode;
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
  onPlay,
  onShuffle,
  actions,
  ref,
}: GenreHeroProps) {
  const { t } = useTranslation("library");

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
        {/* Two levels deep, the trail names the family rather than the shelf:
         * "Electronic / French House" says what this genre is under, which is
         * the one thing the title block no longer repeats. */}
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={genre != null ? genrePath(family) : paths.libraryGenres}
          upLabel={genre != null ? familyLabel : t("genres.back")}
          current={genre ?? familyLabel}
          actions={actions}
        />

        {/* No eyebrow on either depth: a genre used to carry its family's name
         * up here, which made the title block one line taller than the
         * family's and jumped the layout on every chip flip. The family is
         * already present as the "All" chip below and in the breadcrumb's
         * back target, so the line bought nothing but the jump. */}
        <div className="mt-5">
          <h1 className="truncate text-4xl font-semibold tracking-tight">{genre ?? familyLabel}</h1>
          <p className="mt-2 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

          {/* In the band, like the album and artist heroes: the three detail
           * pages answer "how do I start this" in the same place. */}
          <div className="mt-4">
            <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />
          </div>
        </div>
      </div>
    </header>
  );
}
