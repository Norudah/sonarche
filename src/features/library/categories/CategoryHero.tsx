import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { categoryPath, paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";

/** Same shape as the genre breadcrumb: selecting a genre replaces the history
 * entry (one visit), so back leads to wherever the page was entered from, with
 * `up` as the cold-entry fallback. */
function CategoryBreadcrumb({ category, isGenre, current }: { category: string; isGenre: boolean; current: string }) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromList = (state as { fromCategories?: boolean } | null)?.fromCategories === true;

  const up = isGenre ? categoryPath(category) : paths.libraryCategories;

  return (
    <HeroBreadcrumb
      label={t("breadcrumb")}
      backLabel={t("categories.back")}
      current={current}
      onBack={() => (cameFromList ? navigate(-1) : navigate(up))}
    />
  );
}

interface CategoryHeroProps {
  /** Stored category value — the route segment, and where "back" leads. */
  category: string;
  /** The category's display name (translated taxonomy value or free tag). */
  categoryLabel: string;
  /** The genre being inspected inside it, or null for the whole category. */
  genre: string | null;
  albumCount: number;
  trackCount: number;
  artistCount: number;
  share: number;
  onPlay: () => void;
  onShuffle: () => void;
  /** The view switcher, in the same spot as on the genre and artist heroes. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** The genre hero's twin: text on the wash, no invented artwork, one
 * component for both depths so refining by genre never demotes the page. */
export function CategoryHero({
  category,
  categoryLabel,
  genre,
  albumCount,
  trackCount,
  artistCount,
  share,
  onPlay,
  onShuffle,
  actions,
  ref,
}: CategoryHeroProps) {
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
        <CategoryBreadcrumb category={category} isGenre={genre != null} current={genre ?? categoryLabel} />

        <div className="mt-6">
          <h1 className="truncate text-4xl font-semibold tracking-tight">{genre ?? categoryLabel}</h1>
          <p className="mt-2 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

          <div className="mt-5">
            <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle}>
              {actions}
            </HeroPlayButtons>
          </div>
        </div>
      </div>
    </header>
  );
}
