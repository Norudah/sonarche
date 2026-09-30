import { useEffect, useState } from "react";

import type { GateState } from "@/features/onboarding/steps";

/** What the splash says: the wait ends on a short beat before handing over. */
export type SplashPhase = "checking" | "welcome" | "aboard";

/** Milliseconds. `welcome` plays every launch, so it's short; `aboard` once
 * after setup. */
const BEATS: Record<Exclude<SplashPhase, "checking">, number> = {
  welcome: 1200,
  aboard: 2400,
};

/** The splash phase for a gate transition, or `null` to get out of the way. */
export function phaseFor(from: GateState, to: GateState, welcome: boolean): SplashPhase | null {
  // The curtain only shows at launch; later re-checks are shown in place.
  if (to === "checking") return from === "checking" ? "checking" : null;
  // The walkthrough introduces itself.
  if (to === "onboarding") return null;
  // Disabled in Appearance: both beats go.
  if (!welcome) return null;
  return from === "onboarding" ? "aboard" : "welcome";
}

interface Tracked {
  gate: GateState;
  phase: SplashPhase | null;
  /** Sticky, so a later fall back to `checking` doesn't unmount the screen. */
  revealed: boolean;
}

export function useSplashPhase(
  gate: GateState,
  /** The Appearance setting, read once at mount. */
  welcome: boolean,
): { phase: SplashPhase | null; revealed: boolean } {
  const [tracked, setTracked] = useState<Tracked>(() => ({
    gate,
    phase: gate === "checking" ? "checking" : null,
    revealed: gate !== "checking",
  }));

  // Adjusted during render (like `HistoryDepthProvider`), so the old phase never paints.
  if (tracked.gate !== gate) {
    setTracked({
      gate,
      phase: phaseFor(tracked.gate, gate, welcome),
      revealed: tracked.revealed || gate !== "checking",
    });
  }

  const phase = tracked.phase;

  // A beat ends on its own timer.
  useEffect(() => {
    if (phase === null || phase === "checking") return;
    const timer = window.setTimeout(() => setTracked((prev) => ({ ...prev, phase: null })), BEATS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return { phase, revealed: tracked.revealed };
}
