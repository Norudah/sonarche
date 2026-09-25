import { Play, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * Play (labelled pill) and shuffle (small `accent-soft` disc, a variant of
 * play rather than its twin). The disc's hairline keeps it visible on the
 * dark theme's accent-tinted hero.
 */
export function HeroPlayButtons({ onPlay, onShuffle }: { onPlay: () => void; onShuffle: () => void }) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center gap-2">
      <motion.button
        type="button"
        onClick={onPlay}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={springs.snappy}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent pr-5 pl-4.5 text-sm font-medium text-accent-foreground outline-none glow-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* Nudged right: a centred triangle looks left of centre. */}
        <Play className="size-4 translate-x-px fill-current" />
        {t("playAll")}
      </motion.button>

      <ActionHelp text={t("playShuffled")}>
        <motion.button
          type="button"
          onClick={onShuffle}
          aria-label={t("playShuffled")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent/25 ring-inset outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Shuffle className="size-[1.125rem]" />
        </motion.button>
      </ActionHelp>
    </div>
  );
}
