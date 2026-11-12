import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The way out of the setup into the app. The full version opens the scene
 * to the whole window, says welcome on the water, then dissolves into the
 * app; without the welcome (Appearance setting) or with reduced motion, only
 * the final fade is left.
 */
export type EntrancePhase =
  | "idle"
  /** The column steps aside while the scene opens up. */
  | "opening"
  | "welcome"
  /** The opened scene dissolves over the app. */
  | "closing"
  /** The short version: the setup fades straight to the app. */
  | "fading";

type Step = { phase: EntrancePhase | "done"; at: number };

/** Milliseconds from the press. Under 4 s end to end. */
export function entranceSchedule(full: boolean): Step[] {
  if (!full) {
    return [
      { phase: "fading", at: 0 },
      { phase: "done", at: 700 },
    ];
  }
  return [
    { phase: "opening", at: 0 },
    { phase: "welcome", at: 900 },
    { phase: "closing", at: 3000 },
    { phase: "done", at: 3700 },
  ];
}

/** A click or a key cuts straight to the dissolve. */
export function skipSchedule(phase: EntrancePhase): Step[] | null {
  if (phase !== "opening" && phase !== "welcome") return null;
  return [
    { phase: "closing", at: 0 },
    { phase: "done", at: 700 },
  ];
}

export function useEntrance({ full, onDone }: { full: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<EntrancePhase>("idle");
  const timers = useRef<number[]>([]);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  /** Replaces whatever was scheduled; `[]` just cancels. */
  const run = useCallback((steps: Step[]) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    for (const step of steps) {
      const apply = () => {
        if (step.phase !== "done") return setPhase(step.phase);
        setPhase("idle");
        onDoneRef.current();
      };
      if (step.at === 0) apply();
      else timers.current.push(window.setTimeout(apply, step.at));
    }
  }, []);

  useEffect(() => () => run([]), [run]);

  // Listening on the window: the press that started it has already landed.
  useEffect(() => {
    const steps = skipSchedule(phase);
    if (!steps) return;
    const cut = () => run(steps);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === "Escape") cut();
    };
    window.addEventListener("pointerdown", cut);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", cut);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, run]);

  return {
    phase,
    start: () => {
      if (phase === "idle") run(entranceSchedule(full));
    },
  };
}
