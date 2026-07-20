import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { durations, easings, springs } from "@/shared/motion/tokens";

interface AlbumStickyHeaderProps {
  album: Album;
  /** False while the hero is still on screen — the bar would only duplicate it. */
  isVisible: boolean;
  onPlay: () => void;
}

/**
 * The album's identity, kept in reach once the hero has scrolled away.
 *
 * Always mounted, faded in and out rather than added and removed. Mounting it
 * on scroll meant building a blurred, full-width bar in the middle of a scroll
 * gesture — the one moment the main thread has none to spare — and the hitch
 * showed. Opacity and a small slide are compositor work; the element is already
 * there when the moment comes.
 *
 * It carries the primary action so "play this album" never scrolls out of reach
 * on a long tracklist, but not the destructive one, which has no business
 * sitting permanently under the cursor.
 */
export function AlbumStickyHeader({ album, isVisible, onPlay }: AlbumStickyHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <motion.div
      // Hidden it must not swallow clicks meant for the tracklist underneath,
      // nor answer to the keyboard.
      aria-hidden={!isVisible}
      inert={!isVisible}
      initial={false}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -6 }}
      transition={{ duration: durations.fast, ease: easings.out }}
      className={
        "flex items-center gap-3 border-b border-default/60 bg-background px-8 py-2 " +
        (isVisible ? "" : "pointer-events-none")
      }
    >
      <AlbumCover artUrl={album.artUrl} className="size-9 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{album.title}</p>
        <p className="truncate text-[0.6875rem] text-muted">{album.artist || t("unknownArtist")}</p>
      </div>
      <motion.button
        type="button"
        onClick={onPlay}
        aria-label={t("playAll")}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.05 }}
        transition={springs.snappy}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Play className="size-4 fill-current" />
      </motion.button>
    </motion.div>
  );
}
