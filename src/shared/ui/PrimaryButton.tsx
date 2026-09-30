import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { springs } from "@/shared/motion/tokens";

/** The primary action button. Rectangular like the app's other library
 * actions (round buttons are for playback). */
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
      className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground glow-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default ${
        isDisabled && !isPending ? "disabled:opacity-45 disabled:shadow-none" : "disabled:opacity-70"
      }`}
    >
      {isPending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
