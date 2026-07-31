import { useEffect, useState } from "react";

import type { GateState } from "@/features/onboarding/steps";

/**
 * What the splash is saying, and for how long.
 *
 * The gate answers *who* owns the window. This answers a smaller question it
 * used to skip: what happens in the moment the answer arrives. The splash spent
 * the whole wait introducing the app and then vanished mid-sentence, which is a
 * strange way to end the one screen every session opens on.
 *
 * So the wait ends on a beat rather than on a cut — the ark is already drawn,
 * the words under it change, and *then* the window is handed over.
 */
export type SplashPhase = "checking" | "welcome" | "aboard";

/**
 * How long each closing beat holds, in milliseconds.
 *
 * `welcome` plays at every launch, so it is short on purpose: long enough to
 * read four words, not long enough to become the thing standing between someone
 * and their music. `aboard` happens once in the life of an install, at the end
 * of a setup that took a minute — it can afford to be said properly.
 */
const BEATS: Record<Exclude<SplashPhase, "checking">, number> = {
  welcome: 1200,
  aboard: 2400,
};

/**
 * The phase a move from one gate state to the next puts the splash in, or
 * `null` when the splash should get out of the way.
 *
 * Pure and exported for its own test: this is a four-case table, and every case
 * is a different screen the user sees exactly once per launch — the kind of
 * thing that is tedious to check by hand and trivial to check here.
 */
export function phaseFor(from: GateState, to: GateState, welcome: boolean): SplashPhase | null {
  // The curtain belongs to the launch and shows once. A gate that falls back to
  // "checking" later is a refetch, a remount or a re-check — the walkthrough
  // already reports those in place, with its own spinner, and throwing a
  // full-window cover over a screen somebody is reading is a far worse answer
  // than a moment of stale content.
  if (to === "checking") return from === "checking" ? "checking" : null;
  // The walkthrough introduces itself at length and in its own words. A welcome
  // in front of it would be the app saying hello twice before saying anything.
  if (to === "onboarding") return null;
  // Switched off in Appearance. Both beats go together: someone who does not
  // want to be greeted at launch has not asked to be greeted after the setup
  // either. The cross-fade out of the splash is untouched — that one fixed a
  // hard cut, and a hard cut is not a preference.
  if (!welcome) return null;
  return from === "onboarding" ? "aboard" : "welcome";
}

interface Tracked {
  gate: GateState;
  phase: SplashPhase | null;
  /**
   * Whether the gate has ever answered. Sticky, for the same reason the curtain
   * only rises once: a mid-session fall back to `checking` would otherwise
   * unmount the screen the user is on and leave nothing in its place.
   */
  revealed: boolean;
}

export function useSplashPhase(
  gate: GateState,
  /** The Appearance setting, read once at mount by whoever owns the shell. */
  welcome: boolean,
): { phase: SplashPhase | null; revealed: boolean } {
  const [tracked, setTracked] = useState<Tracked>(() => ({
    gate,
    phase: gate === "checking" ? "checking" : null,
    revealed: gate !== "checking",
  }));

  // Set during render, like `HistoryDepthProvider`: React restarts the
  // component before committing, so what is read below is already the adjusted
  // value — no extra frame, and no effect that would let the old phase paint
  // once before the new one replaces it.
  if (tracked.gate !== gate) {
    setTracked({
      gate,
      phase: phaseFor(tracked.gate, gate, welcome),
      revealed: tracked.revealed || gate !== "checking",
    });
  }

  const phase = tracked.phase;

  // A beat ends on its own; that is what makes it a beat and not a state. The
  // gate is not consulted again — it has already given its answer, and this is
  // only the app taking a second to acknowledge it.
  useEffect(() => {
    if (phase === null || phase === "checking") return;
    const timer = window.setTimeout(() => setTracked((prev) => ({ ...prev, phase: null })), BEATS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return { phase, revealed: tracked.revealed };
}
