import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { Family } from "@/features/library/genres/genres";
import { HeroBackdrop } from "@/features/library/HeroBackdrop";

function BackToGenres() {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromList = (state as { fromGenres?: boolean } | null)?.fromGenres === true;

  return (
    <button
      type="button"
      onClick={() => (cameFromList ? navigate(-1) : navigate(paths.libraryGenres))}
      className="relative flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[0.8125rem] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-4" />
      {t("genres.back")}
    </button>
  );
}

/**
 * The album and artist heroes without their square.
 *
 * Every other hero in the app leads with a piece of artwork; a genre has none,
 * and inventing one — a mosaic of four covers from the family — would put a
 * third fabricated thumbnail in the app for an object that is not a thing you
 * can look at. The band is text on the backdrop, tinted by one record of the
 * family so it is still coloured by the music rather than by a constant.
 */
export function GenreHero({
  family,
  label,
  ref,
}: {
  family: Family;
  label: string;
  ref?: Ref<HTMLElement>;
}) {
  const { t } = useTranslation("library");

  const meta = [
    t("trackCount", { count: family.trackCount }),
    t("albumCount", { count: family.albums.length }),
    t("artistCount", { count: family.artistCount }),
  ];

  return (
    <header
      ref={ref}
      className="relative -mx-8 -mt-8 mb-2 overflow-hidden px-8 pt-5 pb-8 text-white"
    >
      <HeroBackdrop artUrl={family.albums.find((album) => album.artUrl)?.artUrl ?? null} />

      <BackToGenres />

      <div className="relative mt-8">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-white/70 uppercase">
          {t("genres.eyebrow")}
        </p>
        <h1 className="mt-1 truncate text-4xl font-semibold tracking-tight">{label}</h1>
        <p className="mt-2 truncate text-[0.8125rem] text-white/80">
          {meta.join(" · ")} · {t("genres.shareOfLibrary", { percent: Math.round(family.share * 100) })}
        </p>
      </div>
    </header>
  );
}
