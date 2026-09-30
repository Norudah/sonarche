import { motion } from "motion/react";

import { springs } from "@/shared/motion/tokens";

/** A multi-stage job as one bar of weighted segments, shared by downloads
 * and imports. */

export type RailTone = "accent" | "success" | "warning" | "danger";

const FILL: Record<RailTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** The fill's leading edge, drawn like the player's seek handle. Sweeps the
 * segment when the stage reports no progress. */
function Playhead({ tone }: { tone: RailTone }) {
  return (
    <span
      className={`absolute top-1/2 right-0 h-3 w-[3px] -translate-y-1/2 translate-x-1/2 rounded-full ${FILL[tone]} shadow-[0_1px_3px_rgb(0_0_0/0.25)]`}
    />
  );
}

interface PipelineRailProps {
  /** 0…1 per segment; the length is the stage count. */
  fills: readonly number[];
  /** Relative widths, since stages take very different times. */
  weights: readonly number[];
  /** May be active at fill 0 (the sweeping handle shows it). */
  activeIndex: number | null;
  failedIndex: number | null;
  tone: RailTone;
  /** Accessible label in place of the bar. */
  label: string;
}

export function PipelineRail({ fills, weights, activeIndex, failedIndex, tone, label }: PipelineRailProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={fills.length}
      aria-valuenow={fills.reduce((sum, fill) => sum + fill, 0)}
      aria-valuetext={label}
      className="flex h-1.5 items-stretch gap-1"
    >
      {fills.map((fill, index) => {
        const isFailed = index === failedIndex;
        const isActive = index === activeIndex;
        const segmentTone = isFailed ? "danger" : tone;
        return (
          <div
            key={index}
            style={{ flexGrow: weights[index] }}
            className={
              "relative basis-0 overflow-visible rounded-full " +
              // The failed stage keeps a tinted trough to show where it stopped.
              (isFailed ? "bg-danger/25" : "bg-default")
            }
          >
            <motion.span
              initial={false}
              animate={{ width: `${fill * 100}%` }}
              transition={springs.soft}
              className={`absolute inset-y-0 left-0 rounded-full ${FILL[segmentTone]}`}
            >
              {isActive && fill > 0 && <Playhead tone={segmentTone} />}
            </motion.span>

            {/* Zero-width fill: the handle sweeps the segment instead. */}
            {isActive && fill === 0 && (
              <span className="animate-rail-scan absolute inset-0">
                <Playhead tone={segmentTone} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
