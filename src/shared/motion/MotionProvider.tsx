import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Honours the OS "reduce motion" setting app-wide: transforms and layout
 * animations are dropped, fades are kept. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
