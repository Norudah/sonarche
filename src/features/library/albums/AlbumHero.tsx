import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";

import { artistPath, paths } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { HeroBackdrop } from "@/features/library/HeroBackdrop";
import { formatDuration } from "@/shared/lib/format";

/**
 * Steps back through history when we arrived from a grid, so the shelf comes
 * back exactly as it was left — scroll, search and sort intact. A plain
 * `<Link>` would push a new entry and rebuild the grid from the top, which is
 * the most irritating way to lose someone's place. Falls back to a normal
 * navigation when the album page was opened cold and there is nothing behind it.
 *
 * The label names where Back actually lands, which is why the caller states it:
 * an album opened from an artist's discography that offers to return to
 * "Albums" is lying about its own history.
 */
function BackToGrid({ artist }: { artist: string }) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = (state as { fromGrid?: boolean; fromArtist?: boolean } | null) ?? {};
  const fallback = from.fromArtist ? artistPath(artist) : paths.libraryAlbums;

  return (
    <button
      type="button"
      onClick={() => (from.fromGrid ? navigate(-1) : navigate(fallback))}
      className="relative flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[0.8125rem] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-4" />
      {from.fromArtist ? artist : t("albums.back")}
    </button>
  );
}

/**
 * Full-bleed band tinted by the album itself — see `HeroBackdrop`.
 *
 * `-mx-8 -mt-8` cancels the scroll area's padding. The page owns that padding,
 * so a full-bleed child has to reach back through it.
 */
export function AlbumHero({ album, ref }: { album: Album; ref?: Ref<HTMLElement> }) {
  const { t } = useTranslation("library");

  const meta = [
    album.year != null ? String(album.year) : null,
    t("trackCount", { count: album.tracks.length }),
    album.length > 0 ? formatDuration(album.length) : null,
    album.formats.join(" · ") || null,
  ].filter(Boolean);

  return (
    <header
      ref={ref}
      className="relative -mx-8 -mt-8 mb-2 overflow-hidden px-8 pt-5 pb-7 text-white"
    >
      <HeroBackdrop artUrl={album.artUrl} />

      {/* Inside the band rather than above it: the hero is full-bleed and
       * starts at the very top of the scroll area, so a back link placed
       * before it would push the whole treatment down the page. */}
      <BackToGrid artist={album.artist} />

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
          {/* The artist name is the way *out* of an album and into everything
           * else by the same artist — the one link that turns the library from
           * a list of records into something you can wander through. Underlined
           * on hover only: a permanently underlined name inside a headline
           * block reads as an error. */}
          <p className="mt-1.5 truncate text-[0.8125rem] text-white/80">
            {album.artist ? (
              <Link
                to={artistPath(album.artist)}
                className="rounded-sm font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/50"
              >
                {album.artist}
              </Link>
            ) : (
              <span className="font-medium text-white">{t("unknownArtist")}</span>
            )}
            {meta.length > 0 && ` · ${meta.join(" · ")}`}
          </p>
        </div>
      </div>
    </header>
  );
}
