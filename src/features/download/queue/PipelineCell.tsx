import { ProgressCircle } from "@heroui/react";
import { Check, Minus } from "lucide-react";
import { motion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import { Swap } from "@/shared/motion/Swap";
import { durations, fade, springs } from "@/shared/motion/tokens";
import {
  type AttemptOutcome,
  jobAttempts,
  trackAttempts,
} from "@/features/download/queue/attempts";
import {
  jobPipeline,
  PIPELINE_STEPS,
  type StepState,
  trackPipeline,
} from "@/features/download/queue/pipeline";

/** The segment between two stage markers. It fills from left to right the moment
 * the stage it leads into stops being pending, so progress reads as travelling
 * down the rail rather than as three independent badges flipping. */
function Connector({ isReached }: { isReached: boolean }) {
  return (
    <div className="relative mt-[9px] h-0.5 w-3 shrink-0 overflow-hidden rounded-full bg-separator">
      <motion.span
        initial={false}
        animate={{ scaleX: isReached ? 1 : 0 }}
        transition={springs.soft}
        className="absolute inset-0 origin-left rounded-full bg-accent"
      />
    </div>
  );
}

/** Fixed-width slots so an album row and its expanded track rows line their
 * stage markers up on the same three columns. `connectors[i]` says whether the
 * segment leading into stage `i` is filled; `null` drops the segments entirely,
 * which is how track rows read as a summary of their parent. */
function Rail({ children, connectors }: { children: ReactNode[]; connectors: boolean[] | null }) {
  return (
    <div className="flex items-start">
      {children.map((node, index) => (
        <Fragment key={index}>
          {index > 0 &&
            (connectors ? (
              <Connector isReached={connectors[index] ?? false} />
            ) : (
              <div className="w-3 shrink-0" />
            ))}
          <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">{node}</div>
        </Fragment>
      ))}
    </div>
  );
}

/** How each state makes its entrance. A stage turning `done` is the milestone
 * the user is waiting on, so it gets the pop; `failed` shakes instead of popping
 * because celebrating a failure reads wrong. Everything else just fades. */
const ENTRY: Record<StepState, { animate: TargetAndTransition; transition: Transition }> = {
  done: { animate: { scale: [0.4, 1], opacity: 1 }, transition: springs.bouncy },
  empty: { animate: { scale: [0.6, 1], opacity: 1 }, transition: springs.snappy },
  failed: {
    animate: { x: [0, -3, 3, -2, 0], opacity: 1 },
    transition: { duration: durations.medium },
  },
  active: { animate: { opacity: 1 }, transition: fade },
  pending: { animate: { opacity: 1 }, transition: fade },
};

function MarkerTransition({ state, children }: { state: StepState; children: ReactNode }) {
  return (
    <Swap
      swapKey={state}
      className="flex items-center justify-center"
      animate={ENTRY[state].animate}
      transition={ENTRY[state].transition}
    >
      {children}
    </Swap>
  );
}

/** Full marker for a job row: a filled disc that carries the stage's state. */
function StepMarker({ state, label }: { state: StepState; label: string }) {
  return (
    <MarkerTransition state={state}>
      <StepGlyph state={state} label={label} />
    </MarkerTransition>
  );
}

function StepGlyph({ state, label }: { state: StepState; label: string }) {
  switch (state) {
    case "done":
      return (
        <span
          role="img"
          aria-label={label}
          className="flex size-5 items-center justify-center rounded-full bg-success text-success-foreground"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      );
    case "active":
      return (
        <ProgressCircle isIndeterminate size="sm" color="accent" aria-label={label}>
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      );
    case "empty":
      return (
        <span
          role="img"
          aria-label={label}
          className="flex size-5 items-center justify-center rounded-full bg-warning text-warning-foreground"
        >
          <Minus className="size-3" strokeWidth={3} />
        </span>
      );
    case "failed":
      return (
        <span
          role="img"
          aria-label={label}
          className="flex size-5 items-center justify-center rounded-full bg-danger text-xs font-bold text-danger-foreground"
        >
          !
        </span>
      );
    case "pending":
      return (
        <span
          role="img"
          aria-label={label}
          className="size-5 rounded-full border-2 border-separator"
        />
      );
  }
}

/** Lighter marker for a track row inside an expanded album: a bare glyph, so
 * the child rows read as a summary of the parent instead of repeating it. */
function TrackStepMarker({ state, label }: { state: StepState; label: string }) {
  return (
    <MarkerTransition state={state}>
      <TrackStepGlyph state={state} label={label} />
    </MarkerTransition>
  );
}

function TrackStepGlyph({ state, label }: { state: StepState; label: string }) {
  switch (state) {
    case "done":
      return <Check className="size-4 text-success" strokeWidth={3} aria-label={label} />;
    case "active":
      return (
        <ProgressCircle isIndeterminate size="sm" color="accent" aria-label={label}>
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      );
    case "empty":
      return <Minus className="size-4 text-warning" strokeWidth={3} aria-label={label} />;
    case "failed":
      return (
        <span
          role="img"
          aria-label={label}
          className="flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-danger-foreground"
        >
          !
        </span>
      );
    case "pending":
      return <span className="text-sm text-muted">—</span>;
  }
}

const ATTEMPT_DOT: Record<AttemptOutcome, string> = {
  success: "bg-success",
  failure: "bg-danger",
  running: "bg-accent animate-pulse",
  untried: "bg-separator",
};

/** One dot per allowed download attempt, under the download stage: it shows at
 * a glance whether a file came down first try or only after YouTube 403s. */
function AttemptDots({ outcomes, label }: { outcomes: AttemptOutcome[]; label: string }) {
  const tried = outcomes.filter((outcome) => outcome !== "untried").length;
  if (tried === 0) return null;
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`${label}: ${tried}/${outcomes.length}`}
    >
      {outcomes.map((outcome, index) => (
        // Keyed on the outcome so a dot re-enters — and pops — when an attempt
        // resolves, rather than silently swapping color.
        <motion.span
          key={`${index}-${outcome}`}
          initial={{ scale: 0.2 }}
          animate={{ scale: 1 }}
          transition={springs.bouncy}
          className={`size-1.5 rounded-full ${ATTEMPT_DOT[outcome]}`}
        />
      ))}
    </span>
  );
}

const STATE_TEXT: Record<StepState, string> = {
  done: "text-foreground",
  active: "text-accent font-medium",
  empty: "text-warning font-medium",
  failed: "text-danger font-medium",
  pending: "text-muted/60",
};

interface JobPipelineCellProps {
  job: DownloadJob;
  /** Byte progress of the one currently downloading job, when it is a single. */
  downloadPercent: number | null;
  /** Tracks whose enrich events have landed, for the one currently enriching job. */
  enrichedCount: number | null;
}

export function JobPipelineCell({ job, downloadPercent, enrichedCount }: JobPipelineCellProps) {
  const { t } = useTranslation("download");
  const steps = jobPipeline(job, downloadPercent, enrichedCount);
  return (
    <Rail connectors={steps.map((step) => step.state !== "pending")}>
      {steps.map((step) => {
        // "Import" while it runs, "Importé" once through — the marker carries
        // the state, the label only needs to name the stage. The exception is
        // `empty`, where the stage name would assert an enrichment that did not
        // happen, so the outcome replaces it.
        const label =
          step.state === "empty"
            ? t("queue.stepState.empty")
            : t(`queue.pipeline.${step.step}.${step.state === "active" ? "active" : "idle"}`);
        return (
          <Fragment key={step.step}>
            <StepMarker
              state={step.state}
              label={`${label} — ${t(`queue.stepState.${step.state}`)}`}
            />
            <span className={`text-center text-[11px] leading-tight ${STATE_TEXT[step.state]}`}>
              {step.detail ? `${label} ${step.detail}` : label}
            </span>
            {step.step === "download" && job.kind !== "album" && (
              <AttemptDots outcomes={jobAttempts(job)} label={t("queue.attempts")} />
            )}
          </Fragment>
        );
      })}
    </Rail>
  );
}

export function TrackPipelineCell({
  track,
  isEnriched,
}: {
  track: AlbumTrackJob;
  isEnriched: boolean;
}) {
  const { t } = useTranslation("download");
  const states = trackPipeline(track, isEnriched);
  return (
    <Rail connectors={null}>
      {states.map((state, index) => {
        const step = PIPELINE_STEPS[index];
        return (
          <Fragment key={step}>
            <TrackStepMarker
              state={state}
              label={`${t(`queue.pipeline.${step}.idle`)} — ${t(`queue.stepState.${state}`)}`}
            />
            {step === "download" && (
              <AttemptDots outcomes={trackAttempts(track)} label={t("queue.attempts")} />
            )}
          </Fragment>
        );
      })}
    </Rail>
  );
}
