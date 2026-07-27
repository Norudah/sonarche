import type { DownloadJob } from "@/features/download/api";
import { survivingTracks } from "@/features/download/queue/pipeline";
import { jobTags } from "@/features/download/queue/tags";

/**
 * What a finished download amounts to, in one verdict.
 *
 * The history table answers this across four columns — pipeline, match, tags,
 * library — which is the right shape for an archive you audit. The activity
 * feed is not that: it is glanced at, so it gets one word, and the four columns
 * become the card's detail panel. This is the reduction, and it is where the
 * ranking between "the batch lost tracks" and "the tags were guessed" is
 * decided once instead of at every call site.
 */
export type JobOutcome =
  /** Matched against MusicBrainz — the only outcome that is plainly good. */
  | { kind: "matched"; source: string | null }
  /** Part of the playlist matched, the rest did not. */
  | { kind: "partialMatch"; matched: number; total: number }
  /** Tagged from the video title rather than from a match: readable, unverified. */
  | { kind: "guessed" }
  /** Ran to the end and identified nothing. */
  | { kind: "unmatched" }
  /** Landed, minus the videos that were gone. */
  | { kind: "lostTracks"; kept: number; total: number }
  | { kind: "failed" };

export type OutcomeTone = "success" | "warning" | "danger";

export const OUTCOME_TONE: Record<JobOutcome["kind"], OutcomeTone> = {
  matched: "success",
  partialMatch: "warning",
  guessed: "warning",
  unmatched: "warning",
  lostTracks: "warning",
  failed: "danger",
};

/**
 * The verdict, or null while the job is still working — a running job is
 * described by its phase, not by an outcome it has not reached.
 *
 * The order below is a ranking from worst to best, and it is the whole point of
 * the function: a playlist can lose two videos *and* guess the tags of a third,
 * and only one of those fits on the card. The user is told the largest problem.
 */
export function jobOutcome(job: DownloadJob): JobOutcome | null {
  if (job.status === "failed") return { kind: "failed" };
  if (job.status !== "done") return null;

  const losses = survivingTracks(job);
  if (losses) return { kind: "lostTracks", ...losses };

  // Dropped duplicates carry no report by design and are not failures to report.
  const real = job.kind === "album" ? job.tracks.filter((track) => track.duplicateOf == null) : [];
  if (real.length > 0) {
    const matched = real.filter((track) => track.report?.mbMatched);
    if (matched.length < real.length) {
      // Nothing matched *and* the sidecar guessed: name the guess, it is the
      // more actionable half — those files carry tags nobody verified.
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
