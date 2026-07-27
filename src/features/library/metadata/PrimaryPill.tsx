import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { springs } from "@/shared/motion/tokens";

/**
 * The metadata panels' primary action — Modifier / Enregistrer — styled and
 * animated like the album hero's "Play all": accent pill with a soft accent
 * shadow, scaling up a touch on hover and pressing in on tap. One place so the
 * track drawer and the album drawer move the same way. While pending it spins a
 * loader, drops its hover/tap motion, and refuses clicks.
 *
 * `isDisabled` is the same visual state without the loader: it is what a Save
 * button wears when there is nothing to save, so the panel never invites a press
 * that would do nothing.
 */
export function PrimaryPill({
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
      className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default ${
        isDisabled && !isPending ? "disabled:opacity-45 disabled:shadow-none" : "disabled:opacity-70"
      }`}
    >
      {isPending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
