import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath, paths } from "@/app/routes";
import { AlbumActions } from "@/features/library/albums/AlbumActions";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { AlbumCompleteness } from "@/features/library/albums/AlbumCompleteness";
import { GenreChips } from "@/features/library/GenreChips";
import { genreFamilyIndex } from "@/features/library/genres/genres";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HeroWash } from "@/features/library/HeroWash";
import { formatDuration } from "@/shared/lib/format";

/**
 * The way *out* of an album and into everything else by the same artist — the
 * one link that turns the library from a list of records into something you can
 * wander through.
 *
 * The underline is a pseudo-element growing from the left rather than
 * `hover:underline`, which has no in-between state: a text-decoration is either
 * there or not, so it snapped on and made a headline look like it had just gone
 * wrong. Scaling a 1px bar is compositor work, and it lets the colour shift to
 * accent over the same 200ms so the two read as one gesture.
 */
function ArtistLink({ artist }: { artist: string }) {
  return (
    <Link
      to={artistPath(artist)}
      className="relative rounded-sm font-medium text-foreground outline-none transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 after:ease-out hover:text-accent hover:after:scale-x-100 focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:after:transition-none"
    >
      {artist}
    </Link>
  );
}

interface AlbumHeroProps {
  album: Album;
  onPlay: () => void;
  onShuffle: () => void;
  onInspect: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
  ref?: Ref<HTMLElement>;
}

/**
 * Full-bleed band — see `HeroWash` for why it is no longer the artwork, and why
 * this header no longer clips its children.
 *
 * `items-end` is what aligns the tag cards with the bottom of the action row:
 * both are last in their column, so bottom-aligning the row aligns them by
 * construction rather than by a hand-tuned offset that would drift the moment a
 * title wraps to two lines.
 *
 * `-mx-8 -mt-8` cancels the scroll area's padding. The page owns that padding,
 * so a full-bleed child has to reach back through it.
 */
export function AlbumHero({ album, onPlay, onShuffle, onInspect, onDelete, onAddToPlaylist, ref }: AlbumHeroProps) {
  const { t } = useTranslation("library");

  const meta = [
    album.year != null ? String(album.year) : null,
    t("trackCount", { count: album.tracks.length }),
    album.length > 0 ? formatDuration(album.length) : null,
    album.formats.join(" · ") || null,
  ].filter(Boolean);

  return (
    <header ref={ref} className="relative -mx-8 -mt-8 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={paths.libraryAlbums}
          upLabel={t("albums.back")}
          current={album.title}
        />

        <div className="mt-5 flex items-end gap-6">
          <AlbumCover artUrl={album.artUrl} className="size-48 shrink-0 rounded-xl glow-accent-deep" />

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
                {t("albums.eyebrow")}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{album.title}</h1>
              <p className="mt-1.5 truncate text-[0.8125rem] text-muted">
                {album.artist ? (
                  <ArtistLink artist={album.artist} />
                ) : (
                  <span className="font-medium text-foreground">{t("unknownArtist")}</span>
                )}
                {meta.length > 0 && ` · ${meta.join(" · ")}`}
              </p>
              <GenreChips genres={album.genres} families={genreFamilyIndex(album.tracks)} />
            </div>

            <AlbumActions
              onPlay={onPlay}
              onShuffle={onShuffle}
              onInspect={onInspect}
              onDelete={onDelete}
              onAddToPlaylist={onAddToPlaylist}
            />
          </div>

          <AlbumCompleteness album={album} />
        </div>
      </div>
    </header>
  );
}
