import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { durations, easings } from "@/shared/motion/tokens";
import { SplashScreen } from "@/features/onboarding/SplashScreen";

/**
 * How the window changes hands when the environment check comes back.
 *
 * The gate next door decides *who* owns the window; this decides what that
 * moment looks like. It used to look like nothing: the splash was returned
 * from one branch and the shell from another, so React swapped one whole
 * screen for another between two frames. Everything about the launch was
 * gradual — the mark easing in, the sliver crossing its track — and then the
 * app simply appeared, which made the polish before it read as a stall.
 *
 * A true cross-fade, not a fade-out then a fade-in: both layers move over the
 * same window of time, in opposite directions. Sequencing them would put a
 * moment between the two where the bare background shows through, and a flash
 * of empty ground is the one thing worse than a hard cut.
 *
 * `children` is mounted only once the splash is on its way out, never behind
 * it. The shell's first render is where the library query fires, and that query
 * needs the very environment the splash is still waiting on — rendering it
 * early would mean an error page finishing its fade-in just as the cover lifts.
 */
export function SplashHandover({ waiting, children }: { waiting: boolean; children: ReactNode }) {
  return (
    <div className="relative h-full">
      {!waiting && (
        <motion.div
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: durations.handover, ease: easings.out }}
        >
          {children}
        </motion.div>
      )}

      <AnimatePresence>
        {waiting && (
          <motion.div
            key="splash"
            // Absolute rather than in the flow: for the two layers to overlap
            // during the cross-fade, the outgoing one has to stop taking space.
            className="absolute inset-0"
            exit={{ opacity: 0 }}
            transition={{ duration: durations.handover, ease: easings.out }}
          >
            <SplashScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
