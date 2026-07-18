import type { AlbumTrackJob, DownloadJob, JobStep } from "@/features/download/api";

export type StepState = "pending" | "active" | "done" | "failed";

export interface PipelineStep {
  step: JobStep;
  state: StepState;
  /** Progress of the running step ("11/16", "43 %"), shown next to its label. */
  detail: string | null;
}

export const PIPELINE_STEPS: JobStep[] = ["download", "import", "enrich"];

/** A track no longer waiting on the network: its file is on disk (or failed). */
export function isFetched(track: AlbumTrackJob): boolean {
  return track.status === "downloaded" || track.status === "imported" || track.status === "done";
}

/** Index of the step the job currently sits on; PIPELINE_STEPS.length once through. */
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
    // A single has no batch to count; only its byte progress is meaningful.
    return step === "download" && downloadPercent != null
      ? `${Math.round(downloadPercent)} %`
      : null;
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

/** The three pipeline stages of a job, each with its state and live progress. */
export function jobPipeline(
  job: DownloadJob,
  downloadPercent: number | null,
  enrichedCount: number | null,
): PipelineStep[] {
  const current = currentIndex(job);
  const hasFailed = job.status === "failed";
  return PIPELINE_STEPS.map((step, index) => {
    if (index < current) return { step, state: "done" as const, detail: null };
    if (index > current) return { step, state: "pending" as const, detail: null };
    if (hasFailed) return { step, state: "failed" as const, detail: null };
    return {
      step,
      state: "active" as const,
      detail: detailFor(job, step, downloadPercent, enrichedCount),
    };
  });
}

/** Same three stages for one album track. Import and enrich run album-wide, so a
 * track only reports them once its own status reflects them. */
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
      return ["done", "done", "done"];
    case "failed":
      return ["failed", "pending", "pending"];
  }
}
