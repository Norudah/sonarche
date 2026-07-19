import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps the app so every animation honours the OS "reduce motion" setting.
 *
 * `reducedMotion="user"` makes Motion drop transform and layout animations when
 * the user asked for less motion, while keeping opacity and color cross-fades —
 * the app still reads as responsive, it just stops moving things around. Wiring
 * it once here means no component has to remember to check.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
