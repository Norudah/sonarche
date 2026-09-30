import { AnimatePresence, motion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import type { ReactNode } from "react";

import { fade } from "@/shared/motion/tokens";

interface SwapProps {
  /** A change drives the transition. */
  swapKey: string | number;
  children: ReactNode;
  className?: string;
  /** Overrides the entry target, e.g. keyframes for a pop. */
  animate?: TargetAndTransition;
  transition?: Transition;
  /**
   * - `wait` (default): exit, then enter. For content whose size changes.
   * - `cross`: both overlap in one grid cell. For fixed-size slots, where
   *   waiting would leave a visible gap.
   */
  mode?: "wait" | "cross";
}

/** Cross-fades between versions of one slot. `initial={false}`: no animation
 * on first paint, only on changes. */
export function Swap({ swapKey, children, className, animate, transition, mode = "wait" }: SwapProps) {
  const content = (
    <motion.span
      key={swapKey}
      initial={{ opacity: 0 }}
      animate={animate ?? { opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition ?? fade}
      className={mode === "cross" ? `[grid-area:1/1] ${className ?? ""}` : className}
    >
      {children}
    </motion.span>
  );

  if (mode === "cross") {
    // One grid cell holds both versions, so the box never collapses.
    return (
      <span className="grid">
        <AnimatePresence initial={false}>{content}</AnimatePresence>
      </span>
    );
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {content}
    </AnimatePresence>
  );
}
