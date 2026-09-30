import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { SplashScreen } from "@/features/onboarding/SplashScreen";
import type { SplashPhase } from "@/features/onboarding/splashPhase";
import { durations, easings } from "@/shared/motion/tokens";

/**
 * The splash as a curtain over a fully painted screen, dissolving away.
 * Nothing renders below until `revealed`: the shell's first paint queries
 * the library, which needs the environment being checked.
 */
export function SplashHandover({
  phase,
  revealed,
  children,
}: {
  /** `null` once the window belongs to the app. */
  phase: SplashPhase | null;
  /** Whether the environment check has answered. */
  revealed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {revealed && children}

      {/* No fade-in at launch; it only animates in over the walkthrough. */}
      <AnimatePresence initial={false}>
        {phase && (
          <motion.div
            key="splash"
            // Out of the flow, so the screen underneath is already in place.
            className="absolute inset-0"
            // Swallows clicks while up, releases them as soon as it starts leaving.
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
