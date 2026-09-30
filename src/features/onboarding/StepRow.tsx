import { Check, ChevronDown, Minus } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";

import type { SetupStep } from "@/features/onboarding/steps";
import { pop, springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";

/** Badge per state. The rail between steps is the app's progress track on
 * end; the active badge is its leading edge. */

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
      {/* The number turns into a check with a pop. */}
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

interface StepRowProps {
  index: number;
  step: SetupStep;
  isLast: boolean;
  title: string;
  /** Verdict once settled, nudge while open. */
  summary?: ReactNode;
  children?: ReactNode;
}

export function StepRow({ index, step, isLast, title, summary, children }: StepRowProps) {
  const [reopened, setReopened] = useState(false);

  // Cleared steps can be reopened (e.g. to re-read the install log); the
  // active one can't be closed.
  const canToggle = children != null && (step.state === "satisfied" || step.state === "skipped");
  const isOpen = children != null && (step.state === "actionRequired" || (canToggle && reopened));

  const header = (
    <>
      <h2
        className={
          "min-w-0 flex-1 truncate text-left text-[0.9375rem] " +
          (step.state === "pending" ? "text-muted" : "font-semibold")
        }
      >
        {title}
      </h2>
      {summary}
    </>
  );

  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <Badge state={step.state} index={index} />
        {!isLast && (
          // Kept off both badges: the active ring overhangs, and the pending fill is translucent.
          <span
            className={`my-1.5 w-px flex-1 transition-colors ${step.state === "satisfied" ? "bg-accent/35" : "bg-separator"}`}
          />
        )}
      </div>

      <div className={"min-w-0 flex-1 " + (isLast ? "pb-0" : "pb-7")}>
        {canToggle ? (
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setReopened((open) => !open)}
            className="flex min-h-7 w-full cursor-pointer items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {header}
            <motion.span initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={springs.snappy}>
              <ChevronDown className="size-4 text-muted" />
            </motion.span>
          </button>
        ) : (
          <div className="flex min-h-7 items-center gap-3">
            {header}
            {/* Keeps titles aligned with or without a chevron. */}
            {children != null && <span className="size-4 shrink-0" />}
          </div>
        )}

        {/* Collapsed, not unmounted: the install log lives in this state. Animates
            height so the steps below move. */}
        <motion.div
          initial={false}
          animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
          transition={springs.soft}
          className="overflow-hidden"
          // Collapsed content stays in the DOM, so remove it from the tab order.
          inert={!isOpen}
        >
          <div className="pt-3">{children}</div>
        </motion.div>
      </div>
    </li>
  );
}

/** Same dot-and-label verdict as the download feed. */
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
