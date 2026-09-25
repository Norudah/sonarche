import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { fade } from "@/shared/motion/tokens";

/**
 * - `EmptyState`: no data at all; an invitation, with an action.
 * - `NoResults`: data exists but the filter excluded it; a quiet line.
 */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Three stacked cover tiles, the front one carrying the glyph. */
function EmptySleeve({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="relative flex size-12 items-center justify-center">
      {/* Tinted: white tiles would vanish on the tray. */}
      <span className="absolute inset-0 -rotate-6 rounded-xl bg-accent/10" />
      <span className="absolute inset-0 rotate-3 rounded-xl bg-accent/20" />
      <span className="relative flex size-12 items-center justify-center rounded-xl bg-surface shadow-sm">
        <Icon className="size-5 text-accent" />
      </span>
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fade}
      className="flex flex-col items-center gap-4 rounded-2xl bg-tray px-6 py-14 text-center"
    >
      <EmptySleeve icon={icon} />

      <div className="flex flex-col gap-1.5">
        <p className="text-[0.9375rem] font-semibold tracking-tight">{title}</p>
        {body && <p className="max-w-md text-[0.8125rem] leading-relaxed text-balance text-muted">{body}</p>}
      </div>

      {action && <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">{action}</div>}
    </motion.div>
  );
}

/** Fades in, since search results update mid-keystroke. */
export function NoResults({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
      className="flex flex-col items-center gap-2 py-16 text-center"
    >
      <Icon className="size-4 shrink-0 text-muted/60" />
      <p className="max-w-md text-sm text-balance text-muted">{message}</p>
    </motion.div>
  );
}
