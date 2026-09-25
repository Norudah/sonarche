import type { DownloadJob } from "@/features/download/api";
import { survivingTracks } from "@/features/download/queue/pipeline";
import { jobTags } from "@/features/download/queue/tags";

/** A finished download reduced to one verdict for the card. */
export type JobOutcome =
  | { kind: "matched"; source: string | null }
  | { kind: "partialMatch"; matched: number; total: number }
  /** Tagged from the video title: readable, unverified. */
  | { kind: "guessed" }
  /** Finished without identifying anything. */
  | { kind: "unmatched" }
  /** Landed, minus videos that were gone. */
  | { kind: "lostTracks"; kept: number; total: number }
  | { kind: "failed" }
  | { kind: "cancelled" };

type OutcomeTone = "accent" | "success" | "warning" | "danger";

export const OUTCOME_TONE: Record<JobOutcome["kind"], OutcomeTone> = {
  matched: "success",
  partialMatch: "warning",
  guessed: "warning",
  unmatched: "warning",
  lostTracks: "warning",
  failed: "danger",
  cancelled: "accent",
};

/** The verdict, or null while running. Checked from worst to best so the
 * card names the biggest problem. */
export function jobOutcome(job: DownloadJob): JobOutcome | null {
  if (job.status === "failed") return { kind: "failed" };
  if (job.status === "cancelled") return { kind: "cancelled" };
  if (job.status !== "done") return null;

  const losses = survivingTracks(job);
  if (losses) return { kind: "lostTracks", ...losses };

  // Dropped duplicates have no report by design.
  const real = job.kind === "album" ? job.tracks.filter((track) => track.duplicateOf == null) : [];
  if (real.length > 0) {
    const matched = real.filter((track) => track.report?.mbMatched);
    if (matched.length < real.length) {
      // Name the guess: those tags are unverified.
      if (matched.length === 0) {
        return jobTags(job)?.provisional ? { kind: "guessed" } : { kind: "unmatched" };
      }
      return { kind: "partialMatch", matched: matched.length, total: real.length };
    }
    return { kind: "matched", source: matched.find((track) => track.report?.source)?.report?.source ?? null };
  }

  const report = job.report;
  if (report?.mbMatched) return { kind: "matched", source: report.source };
  if (report?.provisional) return { kind: "guessed" };
  return { kind: "unmatched" };
}
