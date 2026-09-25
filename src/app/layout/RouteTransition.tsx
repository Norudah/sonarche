import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { durations, easings } from "@/shared/motion/tokens";

/**
 * Fades routed content in on arrival. Opacity only (movement drew the eye),
 * and no exit animation: waiting for it left a blank frame between pages.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: durations.fast, ease: easings.out }}
    >
      {children}
    </motion.div>
  );
}
