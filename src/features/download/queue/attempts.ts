import type { AlbumTrackJob, DownloadJob } from "@/features/download/api";

/** Mirrors DOWNLOAD_ATTEMPTS in src-tauri/src/jobs.rs. Kept as a literal rather
 * than shipped over IPC: it only decides how many dots to draw, and the backend
 * count is the one that actually governs the retries. */
export const DOWNLOAD_ATTEMPTS = 3;

export type AttemptOutcome = "success" | "failure" | "running" | "untried";

type DownloadPhase = "running" | "succeeded" | "failed" | "not-started";

/** One dot per allowed attempt. Any attempt before the last one started failed
 * by construction: the retry loop only moves on after an error. */
export function attemptOutcomes(started: number, phase: DownloadPhase): AttemptOutcome[] {
  return Array.from({ length: DOWNLOAD_ATTEMPTS }, (_, index) => {
    const attempt = index + 1;
    if (phase === "not-started" || attempt > started) return "untried";
    if (attempt < started) return "failure";
    if (phase === "running") return "running";
    return phase === "succeeded" ? "success" : "failure";
  });
}

function jobPhase(job: DownloadJob): DownloadPhase {
  if (job.status === "queued") return "not-started";
  if (job.status === "downloading") return "running";
  if (job.status === "failed" && job.failedStep === "download") return "failed";
  // Importing, enriching, done, or failed later on: the download itself passed.
  return "succeeded";
}

function trackPhase(track: AlbumTrackJob): DownloadPhase {
  switch (track.status) {
    case "pending":
      return "not-started";
    case "downloading":
      return "running";
    case "failed":
      return "failed";
    default:
      return "succeeded";
  }
}

export function jobAttempts(job: DownloadJob): AttemptOutcome[] {
  return attemptOutcomes(job.downloadAttempts, jobPhase(job));
}

export function trackAttempts(track: AlbumTrackJob): AttemptOutcome[] {
  return attemptOutcomes(track.downloadAttempts, trackPhase(track));
}
