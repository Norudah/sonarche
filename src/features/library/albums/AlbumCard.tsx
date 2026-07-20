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
  /** Set on a card shown inside an artist's discography, so the album page
   * offers to go back to that artist rather than to the album shelf. */
  fromArtist?: boolean;
  style?: CSSProperties;
  onPlay: () => void;
}

/**
 * The card is a link and the play button is its *sibling*, not its child: a
 * <button> inside an <a> is invalid HTML and swallows the outer activation.
 * They only look nested because the wrapper is the positioning context.
 */
export function AlbumCard({ album, fromArtist = false, style, onPlay }: AlbumCardProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

  return (
    <div style={style} className="group/card cascade-item relative">
      <Link
        to={albumPath(album.artist, album.title)}
        // Lets the album page know it can go *back* rather than pushing a fresh
        // entry, which is what makes the grid's scroll position survive.
        state={{ fromGrid: true, fromArtist }}
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
        {/* The album-wide metadata panel does not exist yet; the affordance is
         * placed now so the card's layout is settled when it lands. Same
         * "coming soon" treatment as the drawer's view-album action. */}
        <button
          type="button"
          disabled
          aria-label={t("albums.inspect")}
          title={t("metadata.comingSoon")}
          className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white/90 opacity-70 shadow-md backdrop-blur-sm outline-none"
        >
          <FileText className="size-4" />
        </button>

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
