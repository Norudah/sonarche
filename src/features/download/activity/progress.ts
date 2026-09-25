import type { DownloadJob } from "@/features/download/api";
import { isFetched } from "@/features/download/queue/pipeline";

/** A job's progress along its three stages, as the rail draws it. Stage
 * vocabulary lives in `queue/pipeline.ts`. */

/** `queued` and terminal phases have no working segment. */
export type JobPhase = "queued" | "download" | "import" | "enrich" | "done" | "failed" | "cancelled";

/** Track count for playlists, bytes for single files. Unformatted (no i18n here). */
export type ProgressDetail = { kind: "count"; done: number; total: number } | { kind: "percent"; value: number };

export interface JobProgress {
  phase: JobPhase;
  /** 0…1 per segment: download, import, enrich. */
  fills: [number, number, number];
  /** May be active at fill 0 (a single file's import reports no progress). */
  activeIndex: number | null;
  failedIndex: number | null;
  detail: ProgressDetail | null;
}

/** Relative segment widths, roughly matching each stage's duration. */
export const STAGE_WEIGHTS = [3, 1, 2] as const;

const STEP_INDEX = { download: 0, import: 1, enrich: 2 } as const;

function importedCount(job: DownloadJob): number {
  return job.tracks.filter((track) => track.status === "imported" || track.status === "done").length;
}

/** Clamped to 0…1, safe for zero totals. */
function ratio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

/** `downloadPercent` and `enrichedCount` only apply to the one running job. */
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
      // Tracks that never reached the library have nothing to identify.
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
      // Stages before the failed one ran; the failed one is drawn empty in red.
      const index = job.failedStep ? STEP_INDEX[job.failedStep] : 0;
      const fills = [0, 0, 0].map((_, i) => (i < index ? 1 : 0)) as [number, number, number];
      return { phase: "failed", fills, activeIndex: null, failedIndex: index, detail: null };
    }

    case "cancelled":
      return { phase: "cancelled", fills: [0, 0, 0], activeIndex: null, failedIndex: null, detail: null };
  }
}
