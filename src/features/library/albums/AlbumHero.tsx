import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { formatDuration } from "@/shared/lib/format";

/**
 * Full-bleed band tinted by the album itself: the cover, blown up and blurred
 * behind a dark scrim. Same grammar as the metadata drawer's header — dark
 * ground, white text, artwork on the baseline — so the app's one "spotlight"
 * treatment stays recognisable, but coloured by the record instead of a fixed
 * gradient. That is Spotify's trick without needing a colour extracted at
 * import time; with no cover we fall back to the drawer's indigo gradient.
 *
 * `-mx-8 -mt-8` cancels the scroll area's padding. The page owns that padding,
 * so a full-bleed child has to reach back through it.
 */
/**
 * Steps back through history when we arrived from the grid, so the shelf comes
 * back exactly as it was left — scroll, search and sort intact. A plain
 * `<Link>` would push a new entry and rebuild the grid from the top, which is
 * the most irritating way to lose someone's place. Falls back to a normal
 * navigation when the album page was opened cold and there is nothing behind it.
 */
function BackToAlbums() {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const cameFromGrid = (state as { fromGrid?: boolean } | null)?.fromGrid === true;

  return (
    <button
      type="button"
      onClick={() => (cameFromGrid ? navigate(-1) : navigate(paths.libraryAlbums))}
      className="relative flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[0.8125rem] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-4" />
      {t("albums.back")}
    </button>
  );
}

export function AlbumHero({ album }: { album: Album }) {
  const { t } = useTranslation("library");

  const meta = [
    album.year != null ? String(album.year) : null,
    t("trackCount", { count: album.tracks.length }),
    album.length > 0 ? formatDuration(album.length) : null,
    album.formats.join(" · ") || null,
  ].filter(Boolean);

  return (
    <header className="relative -mx-8 -mt-8 mb-2 overflow-hidden px-8 pt-5 pb-7 text-white">
      {album.artUrl ? (
        <>
          {/* scale-110 hides the transparent fringe blur leaves at the edges. */}
          <img
            src={album.artUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover blur-3xl"
          />
          <div className="absolute inset-0 bg-black/55" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-metadata-header-from to-metadata-header-to" />
      )}

      {/* Inside the band rather than above it: the hero is full-bleed and
       * starts at the very top of the scroll area, so a back link placed
       * before it would push the whole treatment down the page. */}
      <BackToAlbums />

      {/* items-end: the text sits on the artwork's baseline rather than
       * floating at its centre. */}
      <div className="relative mt-6 flex items-end gap-6">
        <AlbumCover
          artUrl={album.artUrl}
          className="size-40 shrink-0 rounded-lg shadow-2xl shadow-black/40"
        />
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[0.6875rem] font-semibold tracking-wider text-white/70 uppercase">
            {t("albums.eyebrow")}
          </p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{album.title}</h1>
          <p className="mt-1.5 truncate text-[0.8125rem] text-white/80">
            <span className="font-medium text-white">{album.artist || t("unknownArtist")}</span>
            {meta.length > 0 && ` · ${meta.join(" · ")}`}
          </p>
        </div>
      </div>
    </header>
  );
}
