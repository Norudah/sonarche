import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { durations, easings, springs } from "@/shared/motion/tokens";

interface PlaylistStickyHeaderProps {
  name: string;
  trackCount: number;
  covers: string[];
  customUrl?: string | null;
  favorites?: boolean;
  /** False while the hero is still on screen — the bar would only duplicate it. */
  isVisible: boolean;
  onPlay: () => void;
}

/** The album sticky header's twin — same always-mounted fade, same reason:
 * "play this list" must not scroll out of reach on a long playlist. */
export function PlaylistStickyHeader({
  name,
  trackCount,
  covers,
  customUrl,
  favorites,
  isVisible,
  onPlay,
}: PlaylistStickyHeaderProps) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");

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
      <PlaylistCoverMosaic
        covers={covers}
        customUrl={customUrl}
        favorites={favorites}
        className="size-9 shrink-0 overflow-hidden rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[0.6875rem] text-muted">{t("trackCount", { count: trackCount })}</p>
      </div>
      {trackCount > 0 && (
        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={tPlayer("play")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.05 }}
          transition={springs.snappy}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Play className="size-4 fill-current" />
        </motion.button>
      )}
    </motion.div>
  );
}
