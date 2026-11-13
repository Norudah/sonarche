import { cn } from "@heroui/react";
import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { fade, pop, springs } from "@/shared/motion/tokens";
import { Swap } from "@/shared/motion/Swap";

export type StageState =
  | "done"
  | "active"
  /** Active, with work in flight: a ring turns around the badge. */
  | "busy"
  | "pending"
  | "error";

const BADGE: Record<StageState, string> = {
  done: "bg-accent-fill text-accent-foreground",
  active: "bg-surface text-accent ring-2 ring-accent",
  busy: "bg-surface text-accent ring-2 ring-accent",
  pending: "bg-default text-muted",
  error: "bg-danger text-danger-foreground",
};

function Badge({ state, number }: { state: StageState; number: number }) {
  const glyph = state === "done" ? "done" : state === "error" ? "error" : "number";
  return (
    <span
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-300",
        BADGE[state],
      )}
    >
      {/* The number turns into a check (or a cross) with a pop. */}
      <Swap swapKey={glyph} mode="cross" animate={{ opacity: 1, scale: [0.6, 1.15, 1] }} transition={pop}>
        {glyph === "done" ? (
          <Check className="size-[15px]" strokeWidth={3} />
        ) : glyph === "error" ? (
          <X className="size-3.5" strokeWidth={3} />
        ) : (
          number
        )}
      </Swap>
      {state === "busy" && (
        <span
          aria-hidden
          className="absolute -inset-1.5 animate-spin rounded-full border-2 border-transparent border-t-accent/45 [animation-duration:1s]"
        />
      )}
    </span>
  );
}

interface StageProps {
  number: number;
  state: StageState;
  title: string;
  text?: string;
  /** At the row's end, e.g. a link to open. */
  action?: ReactNode;
}

function Stage({ number, state, title, text, action }: StageProps) {
  return (
    <li
      aria-current={state === "active" || state === "busy" ? "step" : undefined}
      className={cn(
        "relative flex items-start gap-3.5",
        // The thread between badges, kept 6px off each (the busy ring overhangs).
        "after:absolute after:top-[34px] after:bottom-[calc(6px-var(--stage-gap))] after:left-[13.5px] after:w-px last:after:hidden",
        state === "done" ? "after:bg-accent-fill/35" : "after:bg-separator",
      )}
    >
      <Badge state={state} number={number} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
        <span className={cn("text-sm font-semibold", state === "pending" && "text-muted")}>{title}</span>
        {text && (
          <span className={cn("text-[0.78125rem] leading-snug", state === "error" ? "text-danger" : "text-muted")}>
            {text}
          </span>
        )}
      </span>
      {action}
    </li>
  );
}

interface StageCardProps {
  /** Tighter once every stage is behind the user. */
  compact?: boolean;
  /** Under the list, aligned with the titles. */
  footer?: ReactNode;
  /** `StageCard.Stage` items. */
  children: ReactNode;
}

function StageCard({ compact = false, footer, children }: StageCardProps) {
  const gap = compact ? 12 : 18;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.soft, opacity: fade }}
      className="mt-[22px] rounded-xl bg-surface py-[18px] pr-[18px] pl-4 shadow-sm"
    >
      <ol
        className="flex flex-col gap-(--stage-gap) transition-[gap] duration-300"
        style={{ "--stage-gap": `${gap}px` } as CSSProperties}
      >
        {children}
      </ol>
      {footer && <div className="mt-3 ml-[42px]">{footer}</div>}
    </motion.div>
  );
}

StageCard.Stage = Stage;

export { StageCard };
