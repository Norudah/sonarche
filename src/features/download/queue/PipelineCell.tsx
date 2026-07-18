import { ProgressCircle } from "@heroui/react";
import { Check } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";
import { jobPipeline, type StepState, trackPipeline } from "@/features/download/queue/pipeline";

/** Fixed-width slots so an album row and its expanded track rows line their
 * stage markers up on the same three columns. */
function Rail({ children }: { children: ReactNode[] }) {
  return (
    <div className="flex items-start">
      {children.map((node, index) => (
        <Fragment key={index}>
          {index > 0 && <div className="mt-2.5 h-px w-3 shrink-0 bg-separator" />}
          <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">{node}</div>
        </Fragment>
      ))}
    </div>
  );
}

function StepMarker({ state, label }: { state: StepState; label: string }) {
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

const STATE_TEXT: Record<StepState, string> = {
  done: "text-foreground",
  active: "text-accent font-medium",
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
    <Rail>
      {steps.map((step) => {
        // "Import" while it runs, "Importé" once through — the marker carries
        // the state, the label only needs to name the stage.
        const label = t(`queue.pipeline.${step.step}.${step.state === "active" ? "active" : "idle"}`);
        return (
          <Fragment key={step.step}>
            <StepMarker
              state={step.state}
              label={`${label} — ${t(`queue.stepState.${step.state}`)}`}
            />
            <span className={`text-center text-[11px] leading-tight ${STATE_TEXT[step.state]}`}>
              {step.detail ? `${label} ${step.detail}` : label}
            </span>
          </Fragment>
        );
      })}
    </Rail>
  );
}

/** Compact rail for an expanded album track: markers only, labels stay on the
 * parent row that already names the stages. */
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
    <Rail>
      {states.map((state, index) => {
        const step = (["download", "import", "enrich"] as const)[index];
        return state === "pending" ? (
          <span key={step} className="text-sm text-muted">
            —
          </span>
        ) : (
          <StepMarker
            key={step}
            state={state}
            label={`${t(`queue.pipeline.${step}.idle`)} — ${t(`queue.stepState.${state}`)}`}
          />
        );
      })}
    </Rail>
  );
}
