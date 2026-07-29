import { Play, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The primary actions of a page that plays a set: start at the top, or shuffle.
 *
 * These used to be twin labelled pills, on the reasoning that the word is what
 * states the mode. That was too cautious. Two equal buttons say the two things
 * are equal, and they are not — one is what you press, the other is a variant
 * of it — while the pair ran some 180px wide across five heroes. Size carries
 * that hierarchy better than words do, and a round filled play is the one
 * control every listener already reads on sight.
 *
 * The disc is also where the app's shape rule is stated: round means it makes a
 * sound, rectangular means it acts on the library. That is why saving stopped
 * being a pill (see PrimaryButton) — the two shapes mean something now.
 *
 * Both carry `ActionHelp`, because *what* they play is exactly what an icon
 * cannot say. The hero names that scope right above them; the tooltip closes
 * the gap on the pages where the scope is a filtered list rather than a record.
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
    <div className="flex items-center gap-1.5">
      <ActionHelp text={t("playAll")}>
        <motion.button
          type="button"
          onClick={onPlay}
          aria-label={t("playAll")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.05 }}
          transition={springs.snappy}
          className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {/* A centred triangle reads as sitting left of centre — its mass is
              all on one side. One pixel over puts it back on the axis. */}
          <Play className="size-5 translate-x-px fill-current" />
        </motion.button>
      </ActionHelp>

      {/* Unfilled on purpose: a second disc of equal weight would rebuild the
          ambiguity the labels existed to prevent. This is a variant of the
          press beside it, and it should look like one. */}
      <ActionHelp text={t("playShuffled")}>
        <motion.button
          type="button"
          onClick={onShuffle}
          aria-label={t("playShuffled")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.05 }}
          transition={springs.snappy}
          className="flex size-10 cursor-pointer items-center justify-center rounded-full text-muted transition-colors outline-none hover:bg-default/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Shuffle className="size-5" />
        </motion.button>
      </ActionHelp>

      {children}
    </div>
  );
}
