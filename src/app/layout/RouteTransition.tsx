import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { durations, easings } from "@/shared/motion/tokens";

/**
 * Fades the routed content in on navigation. Opacity only, and only on arrival.
 *
 * Only the <Outlet /> is wrapped: the sidebar, topbar and player are the stable
 * frame the app is navigating *inside*, and animating them would undo that.
 *
 * Two things this deliberately no longer does.
 *
 * It does not move. A 4px slide meant every navigation ended with the whole page
 * travelling under the eye, and travel is what the eye tracks — opacity it can
 * ignore. On an app where content also reflows as artwork decodes, that was one
 * moving thing too many.
 *
 * And there is no exit, so no `AnimatePresence` and no `mode="wait"`. Waiting
 * ran the two halves in sequence, which put a gap between them where neither
 * page was on screen and the background showed through — a flash, at the exact
 * moment the user is looking for the page they asked for. The outgoing page now
 * simply goes; only the arrival is worth animating, and it starts immediately.
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
