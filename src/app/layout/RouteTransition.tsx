import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { durations, easings } from "@/shared/motion/tokens";

/**
 * Fades the routed content on navigation. Deliberately tiny — 4px and under
 * 200ms — so it removes the "the screen just blinked" feeling without ever
 * making the user wait on a page they already asked for.
 *
 * Only the <Outlet /> is wrapped: the sidebar, topbar and player are the stable
 * frame the app is navigating *inside*, and animating them would undo that.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: durations.fast, ease: easings.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
