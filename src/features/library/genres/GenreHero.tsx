import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { genrePath, paths } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { HeroBackdrop } from "@/features/library/HeroBackdrop";

/**
 * Back to wherever this page was entered from.
 *
 * There is no "back to the family" step, because selecting a genre replaces the
 * current history entry rather than pushing one — a family and its genres are
 * one visit. That is what stops eight chip flips from costing eight presses to
 * undo, and the family is anyway one click away on the "All" chip.
 *
 * `up` is the cold-entry fallback only: reached without history (a restored
 * session, a direct navigation), the arrow still has somewhere sensible to go.
 */
function BackLink({ family, isGenre }: { family: string; isGenre: boolean }) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromList = (state as { fromGenres?: boolean } | null)?.fromGenres === true;

  const up = isGenre ? genrePath(family) : paths.libraryGenres;

  return (
    <button
      type="button"
      onClick={() => (cameFromList ? navigate(-1) : navigate(up))}
      className="relative flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[0.8125rem] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-4" />
      {t("genres.back")}
    </button>
  );
}

interface GenreHeroProps {
  /** Family key — the route's first segment, and where "back" leads. */
  family: string;
  /** The family's display name. */
  familyLabel: string;
  /** The genre being inspected, or null for the family itself. */
  genre: string | null;
  /** The *family's* albums, not the filtered set. The backdrop is tinted by the
   * family, so flipping a genre chip no longer swaps the image out and replays
   * its fade — the band belongs to the family either way. */
  albums: Album[];
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
 * can look at. The band is text on the backdrop, tinted by one record of the
 * family so it is still coloured by the music rather than by a constant.
 *
 * One component for both depths on purpose: a genre is inspected exactly the
 * way its family is, and giving it a lighter-weight band would have said it was
 * a filter rather than a subject.
 */
export function GenreHero({
  family,
  familyLabel,
  genre,
  albums,
  albumCount,
  trackCount,
  artistCount,
  share,
  ref,
}: GenreHeroProps) {
  const { t } = useTranslation("library");

  // The eyebrow carries the family when a genre is open, so the band says where
  // in the hierarchy you are without spending the title line on it.
  const eyebrow = genre == null ? t("genres.eyebrow") : `${t("genres.eyebrow")} · ${familyLabel}`;

  const meta = [
    t("trackCount", { count: trackCount }),
    t("albumCount", { count: albumCount }),
    t("artistCount", { count: artistCount }),
    t("genres.shareOfLibrary", { percent: Math.round(share * 100) }),
  ];

  return (
    <header
      ref={ref}
      className="relative -mx-8 -mt-8 mb-2 overflow-hidden px-8 pt-5 pb-8 text-white"
    >
      <HeroBackdrop artUrl={albums.find((album) => album.artUrl)?.artUrl ?? null} />

      <BackLink family={family} isGenre={genre != null} />

      <div className="relative mt-8">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-white/70 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 truncate text-4xl font-semibold tracking-tight">
          {genre ?? familyLabel}
        </h1>
        <p className="mt-2 truncate text-[0.8125rem] text-white/80">{meta.join(" · ")}</p>
      </div>
    </header>
  );
}
