import type { AlbumTrackJob, DownloadJob, JobStep, MetadataReport } from "@/features/download/api";

/** `empty` is a step that ran to completion without identifying anything: no
 * MusicBrainz recording answered for the file. It may still have been tagged —
 * the sidecar guesses from the video and flags it — but a guess is not an
 * identity. Distinct from `failed` (the step errored) and from `done` — showing
 * a check there claims a match the Match column reports as absent.
 *
 * `partial` is an album step that ran to the end while some of its tracks fell
 * out along the way (a video pulled from the source, a copyright block). The batch
 * succeeded and the library gained the rest, so painting it `failed` — which is
 * what the row used to do — claimed a run that never happened. */
export type StepState = "pending" | "active" | "done" | "empty" | "failed" | "partial";

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
    case "cancelled":
      // Stopped between steps, no single step to blame; the per-track rows
      // still carry what each one reached before the stop.
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
    // A single has no batch to count; only its byte progress is meaningful.
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

/** Whether a finished job still has something to re-run: it failed outright, or
 * it landed while some of its tracks did not. Mirrors the backend's own gate —
 * a retry only re-queues the failed tracks, never the whole batch. */
export function canRetry(job: DownloadJob): boolean {
  return (
    job.status === "failed" ||
    job.status === "cancelled" ||
    (job.status === "done" && job.tracks.some((track) => track.status === "failed"))
  );
}

/** Tracks the batch carried to the end, over its total — null when nothing was
 * lost, so the caller can treat "no losses" as the plain case. A track that
 * failed never reached *any* stage, which is why one ratio answers for all
 * three. */
export function survivingTracks(job: DownloadJob): { kept: number; total: number } | null {
  if (job.kind !== "album" || job.tracks.length === 0) return null;
  const kept = job.tracks.filter((track) => track.status !== "failed" && track.status !== "unavailable").length;
  return kept === job.tracks.length ? null : { kept, total: job.tracks.length };
}

/** The three pipeline stages of a job, each with its state and live progress. */
export function jobPipeline(
  job: DownloadJob,
  downloadPercent: number | null,
  enrichedCount: number | null,
): PipelineStep[] {
  const current = currentIndex(job);
  const hasFailed = job.status === "failed";
  // A finished album that lost tracks reports every stage as partial, with the
  // tally kept on screen: the stages did run, on fewer tracks than were queued.
  const losses = job.status === "done" ? survivingTracks(job) : null;
  return PIPELINE_STEPS.map((step, index) => {
    if (index < current) {
      if (losses) return { step, state: "partial" as const, detail: `${losses.kept}/${losses.total}` };
      // An album's own report stays null (its tracks carry the reports), so the
      // aggregate row is left alone — only a single can answer for itself here.
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

/** Outcome of a finished enrich step, from the report it left behind. A track
 * dropped as a content duplicate was skipped on purpose, not missed. */
function enrichOutcome(report: MetadataReport | null, isDuplicate: boolean): StepState {
  if (isDuplicate) return "done";
  return report?.mbMatched ? "done" : "empty";
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
      return ["done", "done", enrichOutcome(track.report, track.duplicateOf != null)];
    case "failed":
      return ["failed", "pending", "pending"];
    case "unavailable":
      // `empty`, not `failed`: the step never had a video to work on. Painting
      // it red would blame the run for something the source did to the playlist.
      return ["empty", "empty", "empty"];
  }
}
