import { ImagePlus, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath } from "@/app/routes";
import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { ROW_ACTION_PLAY, ROW_ACTION_SECONDARY } from "@/features/library/cardActions";
import { useArtistImages } from "@/features/library/hooks";

interface ArtistRowsProps {
  artists: Artist[];
  /** Same contract as `ArtistShelf`: what this result set is a result *of*. */
  animationKey?: string;
  onPlay: (artist: Artist) => void;
  onEditImage: (artist: Artist) => void;
}

/** The artists shelf, read as a list — `AlbumRows`' twin, down to the row
 * height, so switching between the two shelves in list mode does not feel like
 * changing app. The avatar stays round: the square ↔ circle split is what tells
 * a record from a person, and it survives the change of layout. */
export function ArtistRows({ artists, animationKey = "", onPlay, onEditImage }: ArtistRowsProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  // One cached query for every row, as in the card.
  const images = useArtistImages();

  return (
    <div key={animationKey} className="flex flex-col">
      {artists.map((artist) => (
        <div
          key={artist.name}
          className="group/row relative flex items-center gap-3 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors hover:bg-default/50"
        >
          <Link
            to={artistPath(artist.name)}
            aria-label={artist.name}
            className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />

          <ArtistAvatar imageUrl={images.data?.get(artist.name) ?? null} className="size-10 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{artist.name}</p>
            <p className="truncate text-[0.8125rem] text-muted">
              {t("albumCount", { count: artist.albums.length })} · {t("trackCount", { count: artist.trackCount })}
            </p>
          </div>

          <span className="hidden w-24 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums sm:inline">
            {artist.span == null
              ? "—"
              : artist.span.from === artist.span.to
                ? artist.span.from
                : `${artist.span.from}–${artist.span.to}`}
          </span>

          {/* Fixed slot, filled on hover — see `AlbumRows`. */}
          <div className="relative flex w-[4.5rem] shrink-0 items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100 has-[:focus-visible]:opacity-100">
            <button
              type="button"
              onClick={() => onEditImage(artist)}
              aria-label={t("artists.image.title")}
              className={ROW_ACTION_SECONDARY}
            >
              <ImagePlus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onPlay(artist)}
              aria-label={tPlayer("play")}
              className={ROW_ACTION_PLAY}
            >
              <Play className="size-3.5 fill-current" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
