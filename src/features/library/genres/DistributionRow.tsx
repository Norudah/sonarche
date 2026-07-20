import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

import { springs } from "@/shared/motion/tokens";

interface DistributionRowProps {
  to: string;
  label: string;
  /** The small line under the label — a family's genres, a genre's family. */
  sublabel: string;
  tone: string;
  /** 0…1, against the largest share on the page rather than against the whole
   * library: with a top family at 21 %, scaling to 100 % would leave every row
   * stuck in its first fifth and nothing would be comparable. The stacked bar
   * above already carries the absolute proportion — these rows carry the
   * comparison. */
  fill: number;
  percent: number;
  /** The right-hand column: counts, or the one call to action. */
  trailing: ReactNode;
  style?: CSSProperties;
}

/**
 * The shape both lists are made of.
 *
 * Shared rather than duplicated because the family list and the genre list are
 * the same page at two depths: the toggle only changes what is being counted,
 * so anything that made the two rows drift apart — a different height, a bar in
 * a different place — would read as switching screens instead of switching
 * unit.
 */
export function DistributionRow({
  to,
  label,
  sublabel,
  tone,
  fill,
  percent,
  trailing,
  style,
}: DistributionRowProps) {
  return (
    <Link
      to={to}
      state={{ fromGenres: true }}
      style={style}
      className="cascade-item group/row flex items-center gap-5 rounded-xl px-3 py-2.5 outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="w-44 shrink-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-[0.6875rem] text-muted">{sublabel}</p>
      </div>

      <div className="h-2 flex-1 overflow-hidden rounded-full bg-default/40">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: fill }}
          transition={springs.soft}
          style={{ background: tone }}
          className="h-full origin-left rounded-full"
        />
      </div>

      <p className="w-12 shrink-0 text-right text-[0.8125rem] tabular-nums text-muted">
        {percent} %
      </p>

      <div className="w-56 shrink-0 text-right text-[0.8125rem]">{trailing}</div>
    </Link>
  );
}
