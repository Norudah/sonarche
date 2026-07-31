import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { SplashScreen } from "@/features/onboarding/SplashScreen";
import type { SplashPhase } from "@/features/onboarding/splashPhase";
import { durations, easings } from "@/shared/motion/tokens";

/**
 * How the window changes hands.
 *
 * The gate next door decides *who* owns it and `splashPhase` decides what the
 * splash says on the way out; this decides what the moment looks like. It used
 * to look like nothing: the splash was returned from one branch and the shell
 * from another, so React swapped one whole screen for another between two
 * frames. Everything before it was gradual — the mark easing in, the sliver
 * crossing its track — and then the app simply appeared, which made the polish
 * ahead of it read as a stall.
 *
 * The splash is a curtain, not a step in a sequence. Whatever comes next is
 * already mounted and fully painted underneath by the time it starts to
 * dissolve, so the app is warm when it is uncovered and there is never a moment
 * where the bare background shows through.
 *
 * `revealed` is the one thing that must not be guessed. Below it, nothing may
 * render at all: the shell's first paint is where the library query fires, and
 * that query needs the very environment the splash is still waiting on —
 * mounting early would mean an error page finishing its fade-in just as the
 * curtain lifts.
 */
export function SplashHandover({
  phase,
  revealed,
  children,
}: {
  /** What the splash is saying, or `null` once the window is the app's. */
  phase: SplashPhase | null;
  /** Whether the environment check has answered at all. */
  revealed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {revealed && children}

      {/* `initial={false}` so the splash is simply *there* at launch rather than
          fading in from an empty window. It does animate in on the way back —
          the beat that follows the walkthrough — which is the one time it
          arrives over something already on screen. */}
      <AnimatePresence initial={false}>
        {phase && (
          <motion.div
            key="splash"
            // Absolute rather than in the flow: the outgoing curtain has to stop
            // taking space for the screen underneath to be in its final place.
            className="absolute inset-0"
            // `pointerEvents` is not animated, it is switched: Motion applies a
            // discrete value at the start of the transition. While the curtain
            // is up it must swallow clicks — a live sidebar under a cover is
            // the exact bug the full-window splash exists to prevent — but the
            // moment it starts to leave, the screen underneath is the one being
            // clicked at, and a half-transparent sheet eating that click is
            // indistinguishable from the app ignoring you.
            initial={{ opacity: 0, pointerEvents: "auto" }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: durations.handover, ease: easings.out }}
          >
            <SplashScreen phase={phase} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
