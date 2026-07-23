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
 */
export function PrimaryPill({
  children,
  onPress,
  isPending = false,
}: {
  children: ReactNode;
  onPress: () => void;
  isPending?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={isPending}
      whileTap={{ scale: isPending ? 1 : 0.96 }}
      whileHover={{ scale: isPending ? 1 : 1.03 }}
      transition={springs.snappy}
      className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground shadow-lg shadow-accent/25 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-70"
    >
      {isPending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
