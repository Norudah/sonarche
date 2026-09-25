import type { AlbumTrackJob, DownloadJob, JobStep, MetadataReport } from "@/features/download/api";

/**
 * - `empty`: completed without identifying anything (tags may be guessed).
 * - `partial`: an album step that finished while some tracks dropped out.
 */
export type StepState = "pending" | "active" | "done" | "empty" | "failed" | "partial";

export interface PipelineStep {
  step: JobStep;
  state: StepState;
  /** Running step's progress ("11/16", "43 %"). */
  detail: string | null;
}

export const PIPELINE_STEPS: JobStep[] = ["download", "import", "enrich"];

/** Done with the network: downloaded or failed. */
export function isFetched(track: AlbumTrackJob): boolean {
  return track.status === "downloaded" || track.status === "imported" || track.status === "done";
}

/** Current step index; `PIPELINE_STEPS.length` once through. */
function currentIndex(job: DownloadJob): number {
  switch (job.status) {
    case "queued":
      return -1;
    case "downloading":
      return 0;
    case "importing":
      return 1;
    case "enriching":
      return 2;
    case "done":
      return PIPELINE_STEPS.length;
    case "failed":
      return job.failedStep ? PIPELINE_STEPS.indexOf(job.failedStep) : 0;
    case "cancelled":
      // Stopped between steps: no single step to blame.
      return -1;
  }
}

function detailFor(
  job: DownloadJob,
  step: JobStep,
  downloadPercent: number | null,
  enrichedCount: number | null,
): string | null {
  const total = job.tracks.length;
  if (job.kind !== "album" || total === 0) {
    // Singles only have byte progress.
    return step === "download" && downloadPercent != null ? `${Math.round(downloadPercent)} %` : null;
  }
  switch (step) {
    case "download":
      return `${job.tracks.filter(isFetched).length}/${total}`;
    case "import":
      return `${job.tracks.filter((track) => track.status === "imported" || track.status === "done").length}/${total}`;
    case "enrich": {
      const enrichable = job.tracks.filter((track) => track.itemId != null).length;
      if (enrichedCount == null || enrichable === 0) return null;
      return `${enrichedCount}/${enrichable}`;
    }
  }
}

/** Failed outright, or finished with failed tracks. Mirrors the backend's gate. */
export function canRetry(job: DownloadJob): boolean {
  return (
    job.status === "failed" ||
    job.status === "cancelled" ||
    (job.status === "done" && job.tracks.some((track) => track.status === "failed"))
  );
}

/** Surviving tracks over total, or null when nothing was lost. */
export function survivingTracks(job: DownloadJob): { kept: number; total: number } | null {
  if (job.kind !== "album" || job.tracks.length === 0) return null;
  const kept = job.tracks.filter((track) => track.status !== "failed" && track.status !== "unavailable").length;
  return kept === job.tracks.length ? null : { kept, total: job.tracks.length };
}

export function jobPipeline(
  job: DownloadJob,
  downloadPercent: number | null,
  enrichedCount: number | null,
): PipelineStep[] {
  const current = currentIndex(job);
  const hasFailed = job.status === "failed";
  // Stages ran on fewer tracks: all reported as partial, with the tally.
  const losses = job.status === "done" ? survivingTracks(job) : null;
  return PIPELINE_STEPS.map((step, index) => {
    if (index < current) {
      if (losses) return { step, state: "partial" as const, detail: `${losses.kept}/${losses.total}` };
      // Album reports live on the tracks; only a single answers for itself here.
      const state = step === "enrich" && job.kind !== "album" ? enrichOutcome(job.report, false) : ("done" as const);
      return { step, state, detail: null };
    }
    if (index > current) return { step, state: "pending" as const, detail: null };
    if (hasFailed) return { step, state: "failed" as const, detail: null };
    return {
      step,
      state: "active" as const,
      detail: detailFor(job, step, downloadPercent, enrichedCount),
    };
  });
}

/** A dropped duplicate was skipped on purpose, not missed. */
function enrichOutcome(report: MetadataReport | null, isDuplicate: boolean): StepState {
  if (isDuplicate) return "done";
  return report?.mbMatched ? "done" : "empty";
}

/** Import and enrich run album-wide, so a track reports them once its own
 * status does. */
export function trackPipeline(track: AlbumTrackJob, isEnriched: boolean): StepState[] {
  switch (track.status) {
    case "pending":
      return ["pending", "pending", "pending"];
    case "downloading":
      return ["active", "pending", "pending"];
    case "downloaded":
      return ["done", "pending", "pending"];
    case "imported":
      return ["done", "done", isEnriched ? "done" : "active"];
    case "done":
      return ["done", "done", enrichOutcome(track.report, track.duplicateOf != null)];
    case "failed":
      return ["failed", "pending", "pending"];
    case "unavailable":
      // `empty`, not `failed`: there was never a video to process.
      return ["empty", "empty", "empty"];
  }
}
