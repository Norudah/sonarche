import { FileText, Play } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { albumPath } from "@/app/routes";
import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { CompletenessBadge } from "@/features/library/albums/CompletenessBadge";
import { springs } from "@/shared/motion/tokens";

interface AlbumCardProps {
  album: Album;
  style?: CSSProperties;
  onPlay: () => void;
  /** Opens the album's metadata drawer. Optional: grids that don't host the
   * drawer simply don't grow the button. */
  onInspect?: () => void;
}

/**
 * The card is a link and the play button is its *sibling*, not its child: a
 * <button> inside an <a> is invalid HTML and swallows the outer activation.
 * They only look nested because the wrapper is the positioning context.
 */
export function AlbumCard({ album, style, onPlay, onInspect }: AlbumCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div style={style} className="group/card cascade-item relative">
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

      <CompletenessBadge value={album.completeness} />

      {/* Rises into place on hover, and stays put once focused so it stays
       * reachable by keyboard — an opacity-only reveal would be a focus trap
       * for anyone not using a mouse. Info sits at the top of the cover
       * (the completeness badge), actions at the bottom. */}
      <div className="absolute right-2.5 bottom-14 flex translate-y-1 items-center gap-1.5 opacity-0 transition-[opacity,translate] group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        {onInspect && (
          <motion.button
            type="button"
            onClick={onInspect}
            aria-label={t("albums.inspect")}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.06 }}
            transition={springs.snappy}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white/90 shadow-md backdrop-blur-sm outline-none transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <FileText className="size-4" />
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-4 fill-current" />
        </motion.button>
      </div>
    </div>
  );
}
