import { animate } from "motion";
import { useEffect, useRef } from "react";

import { pop } from "@/shared/motion/tokens";

/** How far a pop overshoots. One value, so every pop in the app is the same size.
 * Kept generous: a pop that returns to its starting point is only ever on screen
 * for a few hundred ms, so a timid 1.04 reads as nothing happening at all. */
const POP_SCALE = 1.14;

/**
 * Plays a one-shot pop on the returned element the moment `isActive` flips from
 * false to true — a badge lighting up, a button becoming available.
 *
 * Two traps live here, both of which fail silently:
 *
 * 1. The declarative form (`animate={{ scale: [1, 1.12, 1] }}`) never plays.
 *    Motion diffs the target against the current value, and a pop starts and
 *    ends at the same value, so it concludes there is nothing to animate.
 * 2. The `animate` returned by `useAnimate()` is scoped to the *descendants* of
 *    its ref, not the ref itself — pointing it at the scope element writes no
 *    style at all. Hence the standalone `animate` with a plain ref.
 */
export function usePopOnActivate<T extends HTMLElement>(isActive: boolean) {
  const ref = useRef<T>(null);
  const wasActive = useRef(isActive);

  // Syncing with an external system (Motion's animation engine), which is what
  // effects are for — there is no render output to derive this from.
  useEffect(() => {
    if (isActive && !wasActive.current && ref.current) {
      void animate(ref.current, { scale: [1, POP_SCALE, 1] }, pop);
    }
    wasActive.current = isActive;
  }, [isActive]);

  return ref;
}
