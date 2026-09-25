import type { ReactNode } from "react";

/** Status as a dot and a word: quieter than chips when many are listed. */

export type VerdictTone = "accent" | "success" | "warning" | "danger";

const DOT: Record<VerdictTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const TEXT: Record<VerdictTone, string> = {
  accent: "text-muted",
  success: "text-muted",
  warning: "text-warning",
  danger: "text-danger",
};

export function Verdict({ tone, title, children }: { tone: VerdictTone; title?: string; children: ReactNode }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 text-[0.8125rem] whitespace-nowrap tabular-nums ${TEXT[tone]}`}
      title={title}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
