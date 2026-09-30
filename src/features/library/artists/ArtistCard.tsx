import { ImagePlus, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { artistPath } from "@/app/routes";
import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { CARD_ACTION_PLAY, CARD_ACTION_SECONDARY } from "@/features/library/cardActions";
import { useArtistImages } from "@/features/library/hooks";

interface ArtistCardProps {
  artist: Artist;
  style?: CSSProperties;
  /** See `AlbumCard`. */
  cascade?: boolean;
  onPlay: () => void;
  /** The grid hosts one image modal for all cards. */
  onEditImage: () => void;
}

/** A round card (a person, not a release). The play button is the link's
 * sibling; CSS transforms rather than Motion (see `AlbumCard`). */
export function ArtistCard({ artist, style, cascade = true, onPlay, onEditImage }: ArtistCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  // One cached query shared by every card.
  const imageUrl = useArtistImages().data?.get(artist.name) ?? null;

  return (
    <div style={style} className={`group/card relative${cascade ? " cascade-item" : ""}`}>
      <Link
        to={artistPath(artist.name)}
        // Tells the artist page it can go back, preserving the grid's scroll.
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ArtistAvatar
          imageUrl={imageUrl}
          className="aspect-square w-full shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg"
        />
        <p className="mt-2.5 truncate text-center text-sm font-medium">{artist.name}</p>
        <p className="truncate text-center text-[0.8125rem] text-muted">
          {t("albumCount", { count: artist.albums.length })} · {t("trackCount", { count: artist.trackCount })}
        </p>
      </Link>

      {/* Bottom-right like the album card, straddling the rim. Each button reveals
          itself so a focus restored by a closing modal doesn't pin them visible. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end gap-1.5 pr-[5%] pb-[5%]">
        <button
          type="button"
          onClick={onEditImage}
          aria-label={t("artists.image.title")}
          className={`${CARD_ACTION_SECONDARY} pointer-events-auto scale-90 opacity-0 transition-[opacity,scale,background-color] group-hover/card:scale-100 group-hover/card:opacity-100 hover:scale-[1.06] focus-visible:scale-100 focus-visible:opacity-100 active:scale-[0.92]`}
        >
          <ImagePlus className="size-4" />
        </button>

        <button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          className={`${CARD_ACTION_PLAY} pointer-events-auto scale-90 opacity-0 transition-[opacity,scale] group-hover/card:scale-100 group-hover/card:opacity-100 hover:scale-[1.06] focus-visible:scale-100 focus-visible:opacity-100 active:scale-[0.92]`}
        >
          <Play className="size-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
