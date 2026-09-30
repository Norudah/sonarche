import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";

import { genrePath, paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";

interface GenreHeroProps {
  /** The route's first segment. */
  family: string;
  familyLabel: string;
  /** Null for the family itself. */
  genre: string | null;
  albumCount: number;
  trackCount: number;
  artistCount: number;
  share: number;
  onPlay: () => void;
  onShuffle: () => void;
  /** The view switcher, at the end of the breadcrumb line. */
  actions?: ReactNode;
  /** Beside the play buttons; genre depth only. */
  classify?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** The hero for a family or a genre: text on the wash, no invented artwork. */
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
  classify,
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
    <header ref={ref} className="relative -mx-8 -mt-5 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        {/* Names the family, which the title no longer repeats. */}
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={genre != null ? genrePath(family) : paths.libraryGenres}
          upLabel={genre != null ? familyLabel : t("genres.back")}
          current={genre ?? familyLabel}
          actions={actions}
        />

        {/* No eyebrow: it made the layout jump when switching chips. */}
        <div className="mt-5">
          <h1 className="truncate text-4xl font-semibold tracking-tight">{genre ?? familyLabel}</h1>
          <p className="mt-2 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

          <div className="mt-4 flex items-center gap-2">
            <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />
            {classify}
          </div>
        </div>
      </div>
    </header>
  );
}
