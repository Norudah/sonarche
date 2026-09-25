import { ProgressCircle } from "@heroui/react";
import { Check, Minus } from "lucide-react";
import { motion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import type { ReactNode } from "react";

import type { AttemptOutcome } from "@/features/download/queue/attempts";
import type { StepState } from "@/features/download/queue/pipeline";
import { Swap } from "@/shared/motion/Swap";
import { durations, fade, springs } from "@/shared/motion/tokens";

/** Per-track stage glyphs for an unfolded album. */

/** Entrance per state: `done` pops, `failed` shakes, others fade. */
const ENTRY: Record<StepState, { animate: TargetAndTransition; transition: Transition }> = {
  done: { animate: { scale: [0.4, 1], opacity: 1 }, transition: springs.bouncy },
  empty: { animate: { scale: [0.6, 1], opacity: 1 }, transition: springs.snappy },
  partial: { animate: { scale: [0.6, 1], opacity: 1 }, transition: springs.snappy },
  failed: {
    animate: { x: [0, -3, 3, -2, 0], opacity: 1 },
    transition: { duration: durations.medium },
  },
  active: { animate: { opacity: 1 }, transition: fade },
  pending: { animate: { opacity: 1 }, transition: fade },
};

function MarkerTransition({ state, children }: { state: StepState; children: ReactNode }) {
  return (
    <Swap
      swapKey={state}
      className="flex items-center justify-center"
      animate={ENTRY[state].animate}
      transition={ENTRY[state].transition}
    >
      {children}
    </Swap>
  );
}

export function TrackStepMarker({ state, label }: { state: StepState; label: string }) {
  return (
    <MarkerTransition state={state}>
      <TrackStepGlyph state={state} label={label} />
    </MarkerTransition>
  );
}

function TrackStepGlyph({ state, label }: { state: StepState; label: string }) {
  switch (state) {
    case "done":
      return <Check className="size-4 text-success" strokeWidth={3} aria-label={label} />;
    case "active":
      return (
        <ProgressCircle isIndeterminate size="sm" color="accent" aria-label={label}>
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      );
    case "empty":
      return <Minus className="size-4 text-warning" strokeWidth={3} aria-label={label} />;
    // Unreachable for a single track; rendered as a check for exhaustiveness.
    case "partial":
      return <Check className="size-4 text-warning" strokeWidth={3} aria-label={label} />;
    case "failed":
      return (
        <span
          role="img"
          aria-label={label}
          className="flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-danger-foreground"
        >
          !
        </span>
      );
    case "pending":
      return <span className="text-sm text-muted">—</span>;
  }
}

const ATTEMPT_DOT: Record<AttemptOutcome, string> = {
  success: "bg-success",
  failure: "bg-danger",
  running: "bg-accent animate-pulse",
  untried: "bg-separator",
};

/** One dot per allowed download attempt. */
export function AttemptDots({ outcomes, label }: { outcomes: AttemptOutcome[]; label: string }) {
  const tried = outcomes.filter((outcome) => outcome !== "untried").length;
  if (tried === 0) return null;
  return (
    <span className="flex items-center gap-1" aria-label={`${label}: ${tried}/${outcomes.length}`}>
      {outcomes.map((outcome, index) => (
        // Keyed on the outcome so the dot pops when an attempt resolves.
        <motion.span
          key={`${index}-${outcome}`}
          initial={{ scale: 0.2 }}
          animate={{ scale: 1 }}
          transition={springs.bouncy}
          className={`size-1.5 rounded-full ${ATTEMPT_DOT[outcome]}`}
        />
      ))}
    </span>
  );
}
