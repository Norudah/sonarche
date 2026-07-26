import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { durations, easings } from "@/shared/motion/tokens";

const SIZE = 80;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts up to `target` so the figure lands with the arc instead of sitting
 * finished while the ring is still drawing.
 *
 * A raw `requestAnimationFrame` rather than a Motion value: Motion animates
 * styles, and what changes here is text content. The ramp is eased out, matching
 * the arc's own easing, so the two stay together for the whole run.
 *
 * Seeded with the real figure and starting only once a frame actually fires: if
 * frames never come — a background tab, a starved main thread — the number
 * shows the truth and simply does not animate, rather than freezing on a wrong
 * "0". `prefers-reduced-motion` is checked by hand because MotionProvider's
 * `reducedMotion="user"` only governs Motion components, and this is not one.
 */
function useCountUp(target: number, duration: number): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const from = fromRef.current;
    if (from === target) return;

    let frame = 0;
    let started: number | null = null;

    const tick = (now: number) => {
      started ??= now;
      const t = Math.min((now - started) / (duration * 1000), 1);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(from + (target - from) * eased);
      setValue(current);
      fromRef.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return prefersReducedMotion() ? target : value;
}

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
 * The count below is deliberately kept: a percentage hides whether the gap is
 * one field missing everywhere or one track left untouched.
 *
 * The same tag-status colours as the tracklist's dots: amber while any field is
 * still missing (the reserved "incomplete metadata" hue), green once the whole
 * record is tagged. The gauge and the per-track dots then speak one language.
 */
export function AlbumCompleteness({ album }: { album: Album }) {
  const { t } = useTranslation("library");

  // Floor, not round: 99.6% must not display as a complete 100%.
  const target = Math.floor(album.completeness * 100);
  const percent = useCountUp(target, durations.reveal);
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

        {/* The figure is the label of the ring, so it is centred in it rather
            than placed beside it. `tabular-nums` keeps the digits from jittering
            as the count runs through two- and three-digit values. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={
              "text-lg leading-none font-bold tracking-tight tabular-nums " +
              (isComplete ? "text-success" : "text-warning")
            }
          >
            {percent}
            <span className="ml-0.5 text-[0.625rem] font-semibold">%</span>
          </span>
        </div>
      </div>

      <p className="text-[0.6875rem] text-muted">
        {t("albums.stats.taggedCount", { tagged: album.fullyTagged, total: album.tracks.length })}
      </p>
    </div>
  );
}
