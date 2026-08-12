import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";

interface CategoryHeroProps {
  /** The category's display name (translated taxonomy value or free tag). */
  categoryLabel: string;
  /** Always the whole category's, never the selected genre's — see below. */
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

/**
 * The genre hero's twin — text on the wash, no invented artwork — with one
 * deliberate difference: the genre chips never rename this page.
 *
 * They used to. Picking "Synthwave" inside "Video Games" retitled the hero
 * "Synthwave" and left the category nowhere on screen, so a chip on the
 * category card appeared to open a genre page. That was the bug: on the genres
 * axis a sub-genre is a subject with a page of its own, but on this axis a
 * genre is not a sub-category — it is a cut across the category, and a cut does
 * not get to take over the identity of what it cuts.
 *
 * So the title and its counts describe the whole category, always, and the
 * selection lives in the active chip below and in the list it narrows. Same
 * rule the filter bar already follows: the numbers up here state the scope, not
 * the filter.
 */
export function CategoryHero({
  categoryLabel,
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
    <header ref={ref} className="relative -mx-8 -mt-5 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={paths.libraryCategories}
          upLabel={t("categories.back")}
          current={categoryLabel}
          actions={actions}
        />

        <div className="mt-5">
          <h1 className="truncate text-4xl font-semibold tracking-tight">{categoryLabel}</h1>
          <p className="mt-2 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

          <div className="mt-4">
            <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />
          </div>
        </div>
      </div>
    </header>
  );
}
