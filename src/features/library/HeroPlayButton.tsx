import { Play } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";

/**
 * The one primary action of a detail page, as a labelled pill.
 *
 * The library-wide headers keep the bare accent disc: those sit next to a page
 * title where "play" can only mean one thing. On a detail page it competes with
 * a tracklist or a shelf whose every item plays something else, and the word is
 * what says this one starts at the top.
 */
export function HeroPlayButton({ onPlay }: { onPlay: () => void }) {
  const { t } = useTranslation("library");

  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.03 }}
      transition={springs.snappy}
      className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent pr-5 pl-4 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Play className="size-4 fill-current" />
      {t("playAll")}
    </motion.button>
  );
}
