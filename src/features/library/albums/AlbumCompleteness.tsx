import { motion } from "motion/react";

import type { Album } from "@/features/library/albums/albums";
import { durations, easings } from "@/shared/motion/tokens";

const SIZE = 80;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How complete this album's metadata is — the one number the app exists to move,
 * so it gets the shape of a gauge rather than a card in a row of cards.
 *
 * The arc fills from empty on arrival. It is not decoration: an album at 40%
 * and an album at 90% are two different amounts of work, and a ring says which
 * one you are looking at before the digits are read.
 *
 * Drawn with `strokeDasharray`/`strokeDashoffset` on one circle — a single
 * element and no layout, where a masked div or a conic gradient would repaint a
 * box every frame. The `-rotate-90` starts the sweep at twelve o'clock, since
 * SVG angles begin at three.
 *
 * The count in the ring is deliberately a count, not a percentage: a percentage
 * hides whether the gap is one field missing everywhere or one track left
 * untouched.
 *
 * The same tag-status colours as the tracklist's dots: amber while any field is
 * still missing (the reserved "incomplete metadata" hue), green once the whole
 * record is tagged. The gauge and the per-track dots then speak one language.
 */
export function AlbumCompleteness({ album }: { album: Album }) {
  // Floor, not round: 99.6% must not display as a complete 100%.
  const target = Math.floor(album.completeness * 100);
  const isComplete = target === 100;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-separator"
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - target / 100) }}
            transition={{ duration: durations.reveal, ease: easings.out }}
            className={isComplete ? "stroke-success" : "stroke-warning"}
          />
        </svg>

        {/* "18/20" is the fact you can act on; the arc does the proportion,
            which is all a percentage was ever for. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={
              "text-base leading-none font-bold tracking-tight tabular-nums " +
              (isComplete ? "text-success" : "text-warning")
            }
          >
            {album.fullyTagged}
            <span className="opacity-60">/</span>
            {album.tracks.length}
          </span>
        </div>
      </div>
    </div>
  );
}
