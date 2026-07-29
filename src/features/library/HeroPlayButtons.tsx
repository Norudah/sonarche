import { Play, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The primary actions of a page that plays a set: start at the top, or shuffle.
 *
 * One capsule holding two presses, not two buttons. Three shapes were tried and
 * the first two failed for opposite reasons. Twin labelled pills said the modes
 * were equal — they are not, one is the press and the other is a variant of it —
 * and ran some 180px wide across five heroes. A filled disc beside a hollow one
 * fixed the hierarchy but read as a button next to its own ghost: two objects,
 * one of which looks switched off.
 *
 * Fusing them says the true thing. Playing this set is a single subject, and
 * shuffle is the way you enter it — so it is one accent object, divided rather
 * than duplicated. The hairline is what carries that: not a gap between two
 * controls, a fold inside one.
 *
 * The capsule is also where the app's shape rule is stated: round means the
 * press makes a sound, rectangular means it acts on the library. That is why
 * saving, re-matching and inspecting are not round (see heroButton.ts).
 *
 * Both halves carry `ActionHelp`, because *what* they play is exactly what an
 * icon cannot say. The hero names that scope right above them; the tooltip
 * closes the gap on the pages where the scope is a filtered list rather than a
 * record.
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
      {/* The capsule presses as one: the scale lives here rather than on either
          half, so the object never bends.
          `tabIndex={-1}` because Motion makes anything carrying a gesture prop
          focusable, which put an inert tab stop in front of the two real
          buttons — the halves are what you reach, this is only their skin. */}
      <motion.div
        tabIndex={-1}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={springs.snappy}
        className="flex h-12 items-center overflow-hidden rounded-full bg-accent text-accent-foreground glow-accent"
      >
        <ActionHelp text={t("playAll")}>
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("playAll")}
            className="flex h-full cursor-pointer items-center pr-4 pl-5 transition-colors outline-none hover:bg-accent-foreground/12 focus-visible:bg-accent-foreground/12"
          >
            {/* A centred triangle reads as sitting left of centre — its mass is
                all on one side. One pixel over puts it back on the axis. */}
            <Play className="size-5 translate-x-px fill-current" />
          </button>
        </ActionHelp>

        {/* The fold. On the accent itself rather than a separator token: it
            divides one object, so it has to be a lightening of that object. */}
        <span aria-hidden className="h-6 w-px shrink-0 bg-accent-foreground/25" />

        <ActionHelp text={t("playShuffled")}>
          <button
            type="button"
            onClick={onShuffle}
            aria-label={t("playShuffled")}
            className="flex h-full cursor-pointer items-center pr-5 pl-4 transition-colors outline-none hover:bg-accent-foreground/12 focus-visible:bg-accent-foreground/12"
          >
            <Shuffle className="size-[1.125rem]" />
          </button>
        </ActionHelp>
      </motion.div>

      {children}
    </div>
  );
}
