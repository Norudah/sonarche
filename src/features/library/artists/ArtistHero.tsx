import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { Artist } from "@/features/library/artists/artists";
import { ArtistMosaic } from "@/features/library/artists/ArtistMosaic";
import { HeroBackdrop } from "@/features/library/HeroBackdrop";

function BackToArtists() {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromGrid = (state as { fromGrid?: boolean } | null)?.fromGrid === true;

  return (
    <button
      type="button"
      onClick={() => (cameFromGrid ? navigate(-1) : navigate(paths.libraryArtists))}
      className="relative flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[0.8125rem] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-4" />
      {t("artists.back")}
    </button>
  );
}

/**
 * The album hero's twin — same band, same baseline, same backdrop — tinted by
 * the artist's newest cover. Only the payload differs: a discography span and
 * genres where the album shows a year and a format.
 *
 * The stats stay strictly to what the library actually knows. There is no
 * "3 h 42 of listening this month" line here, and there will not be one until a
 * play counter exists; a hero that states a number nothing measures is worse
 * than a hero that states less.
 */
export function ArtistHero({ artist, ref }: { artist: Artist; ref?: Ref<HTMLElement> }) {
  const { t } = useTranslation("library");

  const span =
    artist.span == null
      ? null
      : artist.span.from === artist.span.to
        ? String(artist.span.from)
        : `${artist.span.from} – ${artist.span.to}`;

  const meta = [
    t("albumCount", { count: artist.albums.length }),
    t("trackCount", { count: artist.trackCount }),
    span,
  ].filter(Boolean);

  return (
    <header
      ref={ref}
      className="relative -mx-8 -mt-8 mb-2 overflow-hidden px-8 pt-5 pb-7 text-white"
    >
      <HeroBackdrop artUrl={artist.artUrls[0] ?? null} />

      <BackToArtists />

      <div className="relative mt-6 flex items-end gap-6">
        <div className="size-40 shrink-0 overflow-hidden rounded-lg shadow-2xl shadow-black/40">
          <ArtistMosaic artUrls={artist.artUrls} className="size-full" />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[0.6875rem] font-semibold tracking-wider text-white/70 uppercase">
            {t("artists.eyebrow")}
          </p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{artist.name}</h1>
          <p className="mt-1.5 truncate text-[0.8125rem] text-white/80">{meta.join(" · ")}</p>
          {artist.genres.length > 0 && (
            // On the band rather than in the actions row, unlike the album page:
            // here they describe the artist, and the actions row already carries
            // its own weight with the appearances count.
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {artist.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="rounded-md bg-white/15 px-2 py-0.5 text-[0.6875rem] text-white/90 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
