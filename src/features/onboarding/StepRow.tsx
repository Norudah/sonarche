import { Check, ChevronDown, Minus } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";

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
  children?: ReactNode;
}

export function StepRow({ index, step, isLast, title, summary, children }: StepRowProps) {
  const [reopened, setReopened] = useState(false);

  // A step you have cleared can be looked at again — the install log is the
  // reason, but it holds for all of them: a walkthrough that seals each answer
  // behind you is a walkthrough you cannot re-read. The one you are *on* has no
  // toggle, because closing the step that is asking you something hides the ask.
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
          // Held off both badges: the active one wears a 2px ring that sits
          // *outside* its box, so a rail running edge to edge crossed it — and
          // the pending badge's fill is translucent enough to let the line
          // show through the circle. A gap at each end fixes both, and reads
          // as a rail with stations rather than a line with beads on it.
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
            {/* Keeps the titles of toggleable and non-toggleable rows on the
                same vertical line instead of shifting by a chevron's width. */}
            {children != null && <span className="size-4 shrink-0" />}
          </div>
        )}

        {/* Collapsed rather than unmounted, and that is the point: the engine
            panel holds the install log, which only exists in this component's
            state. Unmounting it on completion — which an AnimatePresence exit
            does — threw away the very thing there is to re-read.
            Height, not opacity alone: the steps below have to move out of the
            way, and a panel that fades in over them reads as a popover. */}
        <motion.div
          initial={false}
          animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
          transition={springs.soft}
          className="overflow-hidden"
          // Collapsed content stays in the DOM, so it has to leave the tab order
          // with it — otherwise focus walks into a panel nobody can see.
          inert={!isOpen}
        >
          <div className="pt-3">{children}</div>
        </motion.div>
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
