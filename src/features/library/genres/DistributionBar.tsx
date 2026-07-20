import { motion } from "motion/react";

import type { Family } from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { springs } from "@/shared/motion/tokens";

interface DistributionBarProps {
  families: Family[];
  tones: Map<string, string>;
  labelOf: (key: string) => string;
}

/**
 * The library as one bar: every family, in order, at its true share.
 *
 * Nothing is grouped into a "rest" segment. A family holding four tracks comes
 * out as a two-pixel sliver, and that sliver is the honest answer — folding it
 * away would hide exactly the fact the page exists to show.
 *
 * `flexGrow` rather than a percentage width: the segments are separated by a
 * gap, so percentages would overflow the row by the total gap width and the
 * last family would be clipped. Growing from a zero basis lets flexbox share
 * out what is left after the gaps, in the right proportions.
 *
 * One transform on the wrapper animates the whole bar, instead of thirteen
 * width animations that would each force a layout pass on every frame.
 */
export function DistributionBar({ families, tones, labelOf }: DistributionBarProps) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={springs.soft}
      className="flex h-2.5 origin-left gap-0.5 overflow-hidden rounded-full"
    >
      {families.map((family) => (
        <div
          key={family.key}
          title={`${labelOf(family.key)} — ${Math.round(family.share * 100)} %`}
          style={{ flexGrow: family.share, background: toneOf(tones, family.key) }}
          className="min-w-0.5 basis-0 rounded-full"
        />
      ))}
    </motion.div>
  );
}
