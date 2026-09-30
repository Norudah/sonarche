import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";

interface CategoryHeroProps {
  /** Translated taxonomy value or free tag. */
  categoryLabel: string;
  /** Always the whole category's. */
  albumCount: number;
  trackCount: number;
  artistCount: number;
  share: number;
  onPlay: () => void;
  onShuffle: () => void;
  /** The view switcher. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** Like the genre hero, but a selected genre never retitles the page: here a
 * genre cuts across the category rather than being a sub-category. Counts
 * describe the whole category. */
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
