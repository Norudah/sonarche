import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { durations, easings, springs } from "@/shared/motion/tokens";

interface ArtistStickyHeaderProps {
  artist: Artist;
  /** The artist's own picture, when they have one. */
  imageUrl: string | null;
  /** False while the hero is still on screen — the bar would only duplicate it. */
  isVisible: boolean;
  onPlay: () => void;
}

/**
 * The album sticky bar's twin. Always mounted and cross-faded rather than added
 * and removed: building a blurred full-width bar mid-scroll gesture is the one
 * moment the main thread has nothing to spare, and the hitch showed.
 */
export function ArtistStickyHeader({ artist, imageUrl, isVisible, onPlay }: ArtistStickyHeaderProps) {
  const { t } = useTranslation("library");

  return (
    <motion.div
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
      <ArtistAvatar imageUrl={imageUrl} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{artist.name}</p>
        <p className="truncate text-[0.6875rem] text-muted">{t("albumCount", { count: artist.albums.length })}</p>
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
