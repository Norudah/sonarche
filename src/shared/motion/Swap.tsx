import { AnimatePresence, motion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import type { ReactNode } from "react";

import { fade } from "@/shared/motion/tokens";

interface SwapProps {
  /** Identity of the current content. A change here drives the transition. */
  swapKey: string | number;
  children: ReactNode;
  className?: string;
  /** Override the entry target — pass keyframes for a pop or a shake. */
  animate?: TargetAndTransition;
  transition?: Transition;
  /**
   * How the two versions overlap in time.
   *
   * - `wait` (default): the old content leaves before the new arrives. Right
   *   when the two differ in size — a track title becoming a longer one — since
   *   overlapping them would need a fixed box.
   * - `cross`: both sit in the same grid cell and dissolve into each other.
   *   Right for a fixed-size slot, where waiting leaves a visible hole. The
   *   play/pause icon is the case: `wait` meant exit *then* enter, so the
   *   button spent a beat as an empty accent circle.
   */
  mode?: "wait" | "cross";
}

/**
 * Cross-fades between two versions of the same slot: a play icon becoming a
 * pause icon, a now-playing title becoming the next one, a pipeline marker
 * turning green.
 *
 * `initial={false}` is the point of this component. Without it, every one of
 * these slots would animate on first paint — landing on a finished queue would
 * pop a dozen markers at once. Only a change that happens while the user is
 * watching is worth animating.
 */
export function Swap({
  swapKey,
  children,
  className,
  animate,
  transition,
  mode = "wait",
}: SwapProps) {
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
    // One grid cell holds both versions, so the box never collapses between them.
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
