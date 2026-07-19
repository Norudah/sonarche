import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { Ref } from "react";
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
 * The band's ground: a fixed indigo gradient, with the album's own cover blown
 * up and blurred over it once it has decoded.
 *
 * Two things here exist purely to stop the banner stuttering on arrival.
 *
 * The gradient is *always* painted rather than being the no-cover alternative.
 * It used to be either/or, so a band with a cover rendered as a dark scrim over
 * nothing for the frames before the image decoded, then the artwork popped in.
 *
 * And the artwork fades in on load instead of appearing the instant it decodes,
 * which turns that pop into a cross-fade from the gradient. Decoding finishes
 * whenever it finishes — that timing is not ours to control, so the arrival is
 * made smooth rather than fast.
 *
 * `will-change-transform` is load-bearing too: a 64px blur across a band this
 * wide is expensive to rasterise, and without its own compositor layer the
 * browser redoes that work on every frame of the page's enter animation. It has
 * to be `will-change` and not Tailwind's `transform-gpu` — v4 puts `scale` in
 * its own property, so `transform-gpu` left the element on a flattened 2D
 * identity matrix and promoted nothing (checked in the browser, not assumed).
 */
function HeroBackdrop({ artUrl }: { artUrl: string | null }) {
  const [isLoaded, setIsLoaded] = useState(false);
  // A cached cover can finish before React attaches onLoad — the callback ref
  // catches that case, where waiting for the event would leave it invisible.
  const catchCached = (node: HTMLImageElement | null) => {
    if (node?.complete) setIsLoaded(true);
  };

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-metadata-header-from to-metadata-header-to" />
      {artUrl && (
        <>
          {/* scale-110 hides the transparent fringe blur leaves at the edges. */}
          <img
            ref={catchCached}
            src={artUrl}
            alt=""
            aria-hidden
            onLoad={() => setIsLoaded(true)}
            className={
              "absolute inset-0 size-full scale-110 object-cover blur-3xl transition-opacity duration-300 will-change-transform " +
              (isLoaded ? "opacity-100" : "opacity-0")
            }
          />
          <div
            className={
              "absolute inset-0 bg-black/55 transition-opacity duration-300 " +
              (isLoaded ? "opacity-100" : "opacity-0")
            }
          />
        </>
      )}
    </>
  );
}

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
