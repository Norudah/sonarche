import { motion } from "motion/react";

import type { JobProgress } from "@/features/download/activity/progress";
import { springs } from "@/shared/motion/tokens";

/**
 * The three stages as one bar rather than three markers.
 *
 * Segments are weighted, not equal: fetching a playlist is minutes of network,
 * filing it is seconds, identifying it is somewhere between. Equal thirds would
 * have the bar sit at 33 % for almost the whole run and then jump — the widths
 * are there so the fill advances at roughly the rate the work does.
 */
const WEIGHTS = [3, 1, 2];

export type RailTone = "accent" | "success" | "warning" | "danger";

const FILL: Record<RailTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * The leading edge of the fill, drawn as the player's own seek handle — a
 * narrow upright bar overhanging the track.
 *
 * Deliberately the same object as the one in the transport at the bottom of
 * the window: this app's subject is audio, and its one recurring "you are here"
 * mark should look the same whether it is running through a song or through a
 * download. On a stage with nothing to count (a lone file's import reports no
 * intermediate progress) it sweeps the segment instead of sitting still, which
 * is the whole activity signal for that stage.
 */
function Playhead({ tone }: { tone: RailTone }) {
  return (
    <span
      className={`absolute top-1/2 right-0 h-3 w-[3px] -translate-y-1/2 translate-x-1/2 rounded-full ${FILL[tone]} shadow-[0_1px_3px_rgb(0_0_0/0.25)]`}
    />
  );
}

interface PipelineRailProps {
  progress: JobProgress;
  tone: RailTone;
  /** Read out to assistive tech in place of the bar — the phase line's text. */
  label: string;
}

export function PipelineRail({ progress, tone, label }: PipelineRailProps) {
  const { fills, activeIndex, failedIndex } = progress;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={3}
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
            style={{ flexGrow: WEIGHTS[index] }}
            className={
              "relative basis-0 overflow-visible rounded-full " +
              // The stage that broke keeps a tinted trough, so the bar shows
              // *where* it stopped instead of merely stopping.
              (isFailed ? "bg-danger/25" : "bg-default")
            }
          >
            <motion.span
              initial={false}
              animate={{ width: `${fill * 100}%` }}
              transition={springs.soft}
              className={`absolute inset-y-0 left-0 rounded-full ${FILL[segmentTone]}`}
            >
              {/* Rides the fill's leading edge. Not on a finished segment: a
                  mark at the very end of a full bar reads as a boundary rather
                  than as a position. */}
              {isActive && fill > 0 && <Playhead tone={segmentTone} />}
            </motion.span>

            {/* A stage with nothing to count gets the handle on the segment
                itself, sweeping it — the fill is zero-width, so a handle riding
                it would have nowhere to sit. */}
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
