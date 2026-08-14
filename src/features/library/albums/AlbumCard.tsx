import { FilePen, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { CARD_ACTION_PLAY, CARD_ACTION_SECONDARY } from "@/features/library/cardActions";

interface AlbumCardProps {
  album: Album;
  style?: CSSProperties;
  /** Whether this card takes part in the grid's entrance cascade. The grid
   * turns it off past the first rows: a thousand cards animating below the
   * fold is a thousand compositor layers nobody sees. */
  cascade?: boolean;
  onPlay: () => void;
  /** Opens the album's metadata drawer. Optional: grids that don't host the
   * drawer simply don't grow the button. */
  onEdit?: () => void;
}

/**
 * The card is a link and the play button is its *sibling*, not its child: a
 * <button> inside an <a> is invalid HTML and swallows the outer activation.
 * They only look nested because the wrapper is the positioning context.
 *
 * Plain buttons with CSS transforms, not motion components: a grid mounts
 * hundreds of these at once, and two Motion instances per card was the single
 * biggest render cost of the Albums page on older machines.
 */
export function AlbumCard({ album, style, cascade = true, onPlay, onEdit }: AlbumCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div style={style} className={`group/card relative${cascade ? " cascade-item" : ""}`}>
      <Link
        to={albumPath(album.artist, album.title)}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl shadow-sm ring-1 ring-separator/60 transition-shadow group-hover/card:shadow-lg">
          <AlbumCover artUrl={album.artUrl} className="size-full" loading="lazy" />
        </div>
        <p className="mt-2.5 truncate text-sm font-medium">{album.title}</p>
        <p className="truncate text-[0.8125rem] text-muted">
          {album.artist || t("unknownArtist")}
          {album.year != null && ` · ${album.year}`}
        </p>
      </Link>

      {/* Rises into place on hover, and stays put once focused so it stays
       * reachable by keyboard — an opacity-only reveal would be a focus trap
       * for anyone not using a mouse.
       *
       * Nothing is stamped on the cover any more. A "62 %" badge sat here on
       * every incomplete record, which on a shelf of two hundred is two hundred
       * grades read at once, none of them saying what is missing. The album's
       * own page carries the verdict; the wall is a wall of covers. */}
      <div className="absolute right-2.5 bottom-14 flex translate-y-1 items-center gap-1.5 opacity-0 transition-[opacity,translate] group-hover/card:translate-y-0 group-hover/card:opacity-100 has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("albums.editMetadata")}
            className={`${CARD_ACTION_SECONDARY} transition hover:scale-[1.06] active:scale-[0.92]`}
          >
            <FilePen className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          className={`${CARD_ACTION_PLAY} transition hover:scale-[1.06] active:scale-[0.92]`}
        >
          <Play className="size-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
