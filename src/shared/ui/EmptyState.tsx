import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { fade } from "@/shared/motion/tokens";

/**
 * What a surface shows when it has nothing to show — one shape, everywhere.
 *
 * Before this, six pages answered the same question six ways: a bare `♪` at
 * 4xl over muted text, a tray with an inbox glyph, a lone centered sentence.
 * The two registers below are the whole vocabulary now, and they are two because
 * the situations differ in kind:
 *
 * - `EmptyState` — the surface has no data *at all*. It is filed on a tray, the
 *   same recessed shelf the download feed uses, because the page is showing you
 *   an empty shelf rather than nothing. An invitation, so it carries an action.
 * - `NoResults` — the data exists and the filter excluded it. Nothing is wrong
 *   and nothing needs building, so it stays a quiet line on the page.
 */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** The way out. An `ActionLink`, usually — the one thing to do from here. */
  action?: ReactNode;
}

/**
 * The empty sleeve: three stacked tiles, the front one carrying the glyph.
 *
 * The app's recurring object is a record with a cover — the album card, the job
 * artwork, the artist tile are all the same square. An empty page is a shelf of
 * those waiting to exist, so the mark is a sleeve rather than an icon in a
 * circle, and the two behind it fan out just enough to read as a stack.
 */
function EmptySleeve({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="relative flex size-12 items-center justify-center">
      {/* Tinted, not white: two white tiles on a near-white tray are invisible,
          and the fan is the whole idea. */}
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

/**
 * A list filtered down to nothing. Fades in rather than appearing in one frame:
 * search is live, so this lands mid-keystroke.
 */
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
