import { FilePen, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { ROW_ACTION_PLAY, ROW_ACTION_SECONDARY } from "@/features/library/cardActions";
import { formatDuration } from "@/shared/lib/format";

interface AlbumRowsProps {
  albums: Album[];
  /** Same contract as `AlbumGrid`: what this result set is a result *of*. */
  animationKey?: string;
  onPlay: (album: Album) => void;
  onEdit?: (album: Album) => void;
}

/**
 * The same shelf, read as a list.
 *
 * A wall of covers is how you recognise a record you already know; a list is
 * how you find one by name, compare years, or see at a glance which of two
 * records is the long one. Neither replaces the other, so the shelf offers
 * both and remembers the answer.
 *
 * No entrance cascade and no virtualization, for the same reason as the grid:
 * the rows are cheap (one image, three lines of text, two buttons on hover) and
 * there can never be more of them than there are covers, which the grid already
 * carries by the hundred. Revisit both together, or neither.
 */
export function AlbumRows({ albums, animationKey = "", onPlay, onEdit }: AlbumRowsProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div key={animationKey} className="flex flex-col">
      {albums.map((album) => (
        <div
          key={album.key}
          className="group/row relative flex items-center gap-3 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors hover:bg-default/50"
        >
          {/* The row is a link and the buttons are its siblings — a <button>
           * inside an <a> is invalid HTML and swallows the outer activation.
           * `absolute inset-0` is what makes the whole row clickable without
           * nesting anything. */}
          <Link
            to={albumPath(album.artist, album.title)}
            aria-label={album.title}
            className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />

          <AlbumCover artUrl={album.artUrl} className="size-10 shrink-0 rounded-md" loading="lazy" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{album.title}</p>
            <p className="truncate text-[0.8125rem] text-muted">{album.artist || t("unknownArtist")}</p>
          </div>

          <span className="w-12 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums">{album.year ?? "—"}</span>
          <span className="hidden w-24 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums sm:inline">
            {t("trackCount", { count: album.tracks.length })}
          </span>
          <span className="hidden w-16 shrink-0 text-right text-[0.8125rem] text-muted tabular-nums md:inline">
            {formatDuration(album.length)}
          </span>

          {/* A fixed slot, filled on hover: revealing the buttons must not
           * change the row's width, or every column would jump as the pointer
           * runs down the list. */}
          <div className="relative flex w-[4.5rem] shrink-0 items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100 has-[:focus-visible]:opacity-100">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(album)}
                aria-label={t("albums.editMetadata")}
                className={ROW_ACTION_SECONDARY}
              >
                <FilePen className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onPlay(album)}
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
