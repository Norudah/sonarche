import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { durations, easings, springs } from "@/shared/motion/tokens";

interface AlbumStickyHeaderProps {
  album: Album;
  /** False while the hero is visible. */
  isVisible: boolean;
  onPlay: () => void;
}

/** Keeps the album and its play button in reach after the hero scrolls away.
 * Always mounted and faded, since mounting a blurred bar mid-scroll hitched. */
export function AlbumStickyHeader({ album, isVisible, onPlay }: AlbumStickyHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <motion.div
      // When hidden, it must not take clicks or focus.
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
