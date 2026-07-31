import type { DownloadJob } from "@/features/download/api";
import { isFetched } from "@/features/download/queue/pipeline";

/**
 * A job's advance along the three stages, as the activity rail draws it.
 *
 * The queue table renders the same three stages as three markers on a line;
 * this is the other reading of the same data — one bar in three segments that
 * fills left to right. Both come off `DownloadJob`, and the shared vocabulary
 * (which stage, in what state) stays in `queue/pipeline.ts`. What lives here is
 * only what a *bar* needs and a row of markers does not: how full each segment
 * is, right now.
 */

/** Which stage the job is on. `queued` and the two terminal states are phases
 * of their own: none of them has a segment doing work. */
export type JobPhase = "queued" | "download" | "import" | "enrich" | "done" | "failed";

/** The figure the phase line carries after the stage name — a tally of tracks
 * for a playlist, bytes for a lone file. Structured, not formatted: this module
 * stays free of i18n. */
export type ProgressDetail = { kind: "count"; done: number; total: number } | { kind: "percent"; value: number };

export interface JobProgress {
  phase: JobPhase;
  /** Fill of each segment, 0…1, in download / import / enrich order. */
  fills: [number, number, number];
  /**
   * The segment currently working, or null. An active segment can sit at fill
   * 0 and still be working — a single file's import reports no intermediate
   * progress — which is exactly what the rail's travelling sheen is for.
   */
  activeIndex: number | null;
  /** The segment the job died on, so the rail can stop there in red. */
  failedIndex: number | null;
  detail: ProgressDetail | null;
}

/**
 * Relative widths of the three segments on the rail. Not equal thirds: fetching
 * a playlist is minutes of network, filing it is seconds, identifying it is
 * somewhere between — the weights are what make the fill advance at roughly the
 * rate the work does.
 */
export const STAGE_WEIGHTS = [3, 1, 2] as const;

const STEP_INDEX = { download: 0, import: 1, enrich: 2 } as const;

/** Tracks that reached at least the import stage. */
function importedCount(job: DownloadJob): number {
  return job.tracks.filter((track) => track.status === "imported" || track.status === "done").length;
}

/** A ratio that never divides by zero and never overshoots the segment. */
function ratio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

/**
 * `downloadPercent` and `enrichedCount` are the live figures the page holds for
 * the one job currently working — the worker is sequential, so at most one job
 * ever gets them. Every other job is described by its stored state alone.
 */
export function jobProgress(
  job: DownloadJob,
  downloadPercent: number | null,
  enrichedCount: number | null,
): JobProgress {
  const isAlbum = job.kind === "album" && job.tracks.length > 0;
  const total = job.tracks.length;

  switch (job.status) {
    case "queued":
      return { phase: "queued", fills: [0, 0, 0], activeIndex: null, failedIndex: null, detail: null };

    case "downloading": {
      const fetched = job.tracks.filter(isFetched).length;
      const fill = isAlbum ? ratio(fetched, total) : ratio(downloadPercent ?? 0, 100);
      return {
        phase: "download",
        fills: [fill, 0, 0],
        activeIndex: 0,
        failedIndex: null,
        detail: isAlbum
          ? { kind: "count", done: fetched, total }
          : downloadPercent != null
            ? { kind: "percent", value: Math.round(downloadPercent) }
            : null,
      };
    }

    case "importing": {
      const imported = importedCount(job);
      return {
        phase: "import",
        fills: [1, isAlbum ? ratio(imported, total) : 0, 0],
        activeIndex: 1,
        failedIndex: null,
        detail: isAlbum ? { kind: "count", done: imported, total } : null,
      };
    }

    case "enriching": {
      // Only tracks that made it into the library have anything to identify —
      // a dead video must not hold the segment short of the end forever.
      const enrichable = isAlbum ? job.tracks.filter((track) => track.itemId != null).length : 1;
      return {
        phase: "enrich",
        fills: [1, 1, enrichedCount != null ? ratio(enrichedCount, enrichable) : 0],
        activeIndex: 2,
        failedIndex: null,
        detail: isAlbum && enrichedCount != null ? { kind: "count", done: enrichedCount, total: enrichable } : null,
      };
    }

    case "done":
      return { phase: "done", fills: [1, 1, 1], activeIndex: null, failedIndex: null, detail: null };

    case "failed": {
      // Everything before the stage that broke did run; the stage itself is
      // drawn empty, in the failure colour, and nothing past it is drawn at all.
      const index = job.failedStep ? STEP_INDEX[job.failedStep] : 0;
      const fills = [0, 0, 0].map((_, i) => (i < index ? 1 : 0)) as [number, number, number];
      return { phase: "failed", fills, activeIndex: null, failedIndex: index, detail: null };
    }
  }
}
