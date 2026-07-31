import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { springs } from "@/shared/motion/tokens";

/**
 * The app's primary action — Enregistrer, Modifier, Chercher les paroles.
 *
 * Shared rather than filed under the metadata panels, which is where it grew
 * up: three surfaces in two layers now press it, and the player's is one of
 * them — `shared` cannot reach into a feature.
 *
 * It was a pill, copied from the album hero's "Play all" so the two would move
 * alike. Moving alike was right; looking alike was not. Shape carries a meaning
 * in this app now: round means the press makes a sound, rectangular means it
 * acts on the library (see HeroPlayButtons). Saving metadata is the second
 * kind, and it is the busiest control in the two drawers — so it takes the same
 * `rounded-xl` as Récupérer and Importer, the app's other two commits.
 *
 * The motion is unchanged: scaling up a touch on hover, pressing in on tap,
 * spinning a loader and refusing clicks while pending. `isDisabled` is the same
 * visual state without the loader — what a Save button wears when there is
 * nothing to save, so the panel never invites a press that would do nothing.
 */
export function PrimaryButton({
  children,
  onPress,
  isPending = false,
  isDisabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  isPending?: boolean;
  isDisabled?: boolean;
}) {
  const isInert = isPending || isDisabled;

  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={isInert}
      whileTap={{ scale: isInert ? 1 : 0.96 }}
      whileHover={{ scale: isInert ? 1 : 1.03 }}
      transition={springs.snappy}
      // Pending stays legible (it is working, and says so); disabled recedes
      // further, because nothing is happening and nothing will.
      className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default ${
        isDisabled && !isPending ? "disabled:opacity-45 disabled:shadow-none" : "disabled:opacity-70"
      }`}
    >
      {isPending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
