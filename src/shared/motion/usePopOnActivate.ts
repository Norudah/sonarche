import { animate } from "motion";
import { useEffect, useRef } from "react";

import { pop } from "@/shared/motion/tokens";

/** Generous: the pop only lasts a few hundred ms. */
const POP_SCALE = 1.14;

/**
 * Plays a pop when `isActive` turns true. Imperative on purpose:
 * - `animate={{ scale: [1, 1.12, 1] }}` never plays (same start and end value).
 * - `useAnimate()` only targets descendants of its scope, not the scope itself.
 */
export function usePopOnActivate<T extends HTMLElement>(isActive: boolean) {
  const ref = useRef<T>(null);
  const wasActive = useRef(isActive);

  useEffect(() => {
    if (isActive && !wasActive.current && ref.current) {
      void animate(ref.current, { scale: [1, POP_SCALE, 1] }, pop);
    }
    wasActive.current = isActive;
  }, [isActive]);

  return ref;
}
