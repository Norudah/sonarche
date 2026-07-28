import { Play, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";

function AccentPill({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.03 }}
      transition={springs.snappy}
      className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent pr-5 pl-4 text-sm font-medium text-accent-foreground glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
    </motion.button>
  );
}

/**
 * The primary actions of a page that plays a set, as twin labelled pills —
 * play in order, play shuffled. Two equal buttons rather than one plus a
 * toggle: the label is what states the mode, so each press says exactly what
 * it launches — this album, this artist, this filtered list.
 *
 * On a detail page the words also disambiguate: the pills compete with a
 * tracklist or a shelf whose every item plays something else, and "Tout lire"
 * is what says this one starts at the top.
 */
export function HeroPlayButtons({
  onPlay,
  onShuffle,
  children,
}: {
  onPlay: () => void;
  onShuffle: () => void;
  /** Secondary actions of the same band — a slot rather than a prop, because
   * what a page adds here is a whole control, not a label. */
  children?: ReactNode;
}) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center gap-2">
      <AccentPill onPress={onPlay}>
        <Play className="size-4 fill-current" />
        {t("playAll")}
      </AccentPill>
      <AccentPill onPress={onShuffle}>
        <Shuffle className="size-4" />
        {t("playShuffled")}
      </AccentPill>
      {children}
    </div>
  );
}
