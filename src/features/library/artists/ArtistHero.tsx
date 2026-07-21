import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { Artist } from "@/features/library/artists/artists";
import { ArtistMosaic } from "@/features/library/artists/ArtistMosaic";
import { GenreChips } from "@/features/library/GenreChips";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroPlayButton } from "@/features/library/HeroPlayButton";
import { HeroWash } from "@/features/library/HeroWash";

function ArtistBreadcrumb({ name }: { name: string }) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromGrid = (state as { fromGrid?: boolean } | null)?.fromGrid === true;

  return (
    <HeroBreadcrumb
      label={t("breadcrumb")}
      backLabel={t("artists.back")}
      current={name}
      onBack={() => (cameFromGrid ? navigate(-1) : navigate(paths.libraryArtists))}
    />
  );
}

interface ArtistHeroProps {
  artist: Artist;
  onPlay: () => void;
  ref?: Ref<HTMLElement>;
}

/**
 * The album hero's twin — same band, same wash, same baseline. Only the payload
 * differs: a discography span and genres where the album shows a year and a
 * format.
 *
 * The stats stay strictly to what the library actually knows. There is no
 * "3 h 42 of listening this month" line here, and there will not be one until a
 * play counter exists; a hero that states a number nothing measures is worse
 * than a hero that states less.
 */
export function ArtistHero({ artist, onPlay, ref }: ArtistHeroProps) {
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
    <header ref={ref} className="relative -mx-8 -mt-8 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <ArtistBreadcrumb name={artist.name} />

        <div className="mt-5 flex items-end gap-6">
          {/* Larger than the album's 192px cover on purpose: the mosaic insets
           * its artwork on an 11% mount, so at an equal frame the covers read
           * markedly smaller than a bordered-to-edge album cover. The bigger
           * frame gives the inset artwork back the presence the mount costs it. */}
          <div className="size-56 shrink-0 overflow-hidden rounded-xl shadow-xl shadow-accent/20">
            <ArtistMosaic artUrls={artist.artUrls} className="size-full" />
          </div>

          {/* Capped rather than stretched: the album's text column is bounded on
           * its right by the completeness ring, so it never looks empty. This
           * hero has no such right-hand anchor, and a full-width `flex-1` column
           * left its short title and stats floating in a half-blank band. The
           * cap keeps them a tight block and turns the rest into clean margin. */}
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
              {t("artists.eyebrow")}
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{artist.name}</h1>
            <p className="mt-1.5 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

            {/* Capped at four: an artist spanning six genres would otherwise
             * push a second row of chips into the band. The album shows all of
             * its own, which are far fewer. */}
            <GenreChips genres={artist.genres.slice(0, 4)} />

            {/* In the band, like the album's action row: a lone play button
             * under a full-bleed hero reads as orphaned, and the two pages
             * should answer "how do I start this" in the same place.
             *
             * No delete action, unlike the album page. "Delete this artist"
             * would wipe an unbounded number of albums behind one click, and
             * nothing here makes that scope visible before it happens. */}
            <div className="mt-5">
              <HeroPlayButton onPlay={onPlay} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
