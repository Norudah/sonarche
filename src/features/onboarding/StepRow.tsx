import { Check, Minus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import type { SetupStep } from "@/features/onboarding/steps";
import { pop, springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";

/**
 * One step, and the piece of rail that leads to the next one.
 *
 * The rail is the same object as the download feed's pipeline and the player's
 * seek bar, stood on end: a pale track that fills as you advance. Its leading
 * edge is the active badge itself rather than a separate marker — the app
 * already has one "you are here" mark, and drawing a second one beside it would
 * be two objects saying the same thing.
 */

const BADGE: Record<SetupStep["state"], string> = {
  satisfied: "bg-accent text-accent-foreground",
  actionRequired: "bg-surface text-accent ring-2 ring-accent shadow-sm",
  pending: "bg-default text-muted",
  skipped: "bg-default text-muted",
};

function Badge({ state, index }: { state: SetupStep["state"]; index: number }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold tabular-nums transition-colors ${BADGE[state]}`}
    >
      {/* The number *becomes* the check — the one milestone in the flow worth a
          pop, and the reason `bouncy`/`pop` exist as tokens. */}
      <Swap swapKey={state} mode="cross" animate={{ opacity: 1, scale: [0.6, 1.15, 1] }} transition={pop}>
        {state === "satisfied" ? (
          <Check className="size-4" strokeWidth={3} />
        ) : state === "skipped" ? (
          <Minus className="size-3.5" strokeWidth={3} />
        ) : (
          index
        )}
      </Swap>
    </span>
  );
}

export interface StepRowProps {
  index: number;
  step: SetupStep;
  isLast: boolean;
  title: string;
  /** The right-hand column: a verdict once settled, a nudge while it is open. */
  summary?: ReactNode;
  /** Rendered only while the step is the one being acted on. */
  children?: ReactNode;
}

export function StepRow({ index, step, isLast, title, summary, children }: StepRowProps) {
  const isOpen = step.state === "actionRequired" && children != null;

  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <Badge state={step.state} index={index} />
        {!isLast && (
          <span
            className={`w-px flex-1 transition-colors ${step.state === "satisfied" ? "bg-accent/35" : "bg-separator"}`}
          />
        )}
      </div>

      <div className={"min-w-0 flex-1 " + (isLast ? "pb-0" : "pb-7")}>
        <div className="flex min-h-7 items-center gap-3">
          <h2
            className={
              "min-w-0 flex-1 truncate text-[0.9375rem] " + (step.state === "pending" ? "text-muted" : "font-semibold")
            }
          >
            {title}
          </h2>
          {summary}
        </div>

        {/* Height, not opacity: the steps below have to move out of the way, and
            a panel that fades in over them reads as a popover. Same transition
            as the download card's detail, for the same reason. */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springs.soft}
              className="overflow-hidden"
            >
              <div className="pt-3">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

/** The download feed's verdict, reused: a tone dot and a quiet label. */
export function StepSummary({ tone, children }: { tone: "success" | "muted" | "warning"; children: ReactNode }) {
  const dot = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-muted/40";
  const text = tone === "warning" ? "text-warning" : "text-muted";
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-[0.8125rem] whitespace-nowrap ${text}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
