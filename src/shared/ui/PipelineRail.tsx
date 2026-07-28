import { motion } from "motion/react";

import { springs } from "@/shared/motion/tokens";

/**
 * A multi-stage job as one bar in weighted segments.
 *
 * Shared rather than owned by the download feed: the two ways music enters the
 * ark are a download and a folder import, both are a fixed chain of stages, and
 * the app must not have two readings of "how far along is this". What the caller
 * brings is the shape of its own pipeline — how many stages, how long each one
 * really takes, where it currently is.
 */

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
  /** Fill of each segment, 0…1, in stage order. Its length is the stage count. */
  fills: readonly number[];
  /**
   * Relative segment widths. Stages never take the same time — fetching a
   * playlist is minutes of network, filing it is seconds — and equal thirds
   * would park the bar at 33 % for most of the run and then jump.
   */
  weights: readonly number[];
  /** The segment working right now, or null. It may sit at fill 0 and still be
   * working, which is what the sweeping playhead is for. */
  activeIndex: number | null;
  /** The segment the job died on, so the rail can stop there in red. */
  failedIndex: number | null;
  tone: RailTone;
  /** Read out to assistive tech in place of the bar — the phase line's text. */
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
