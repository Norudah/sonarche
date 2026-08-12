/**
 * The import as three stages on one rail — the same object the download feed
 * draws, fed by this page's own pipeline.
 *
 * Pure and apart from the card, because what is interesting here is not the
 * layout: it is deciding how full each segment is at a moment where the two
 * counts being reported (album folders, then covers) measure different things.
 */

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import type { RailTone } from "@/shared/ui/PipelineRail";

export const IMPORT_STAGES = ["scan", "copy", "covers"] as const;
export type ImportStage = (typeof IMPORT_STAGES)[number];

/**
 * Relative segment widths. The walk is quick, the copy is the whole job, and
 * the cover pass is a short tail — equal thirds would have the bar sit at 33 %
 * for minutes and then jump twice.
 */
export const STAGE_WEIGHTS = [2, 5, 2] as const;

export interface ImportRail {
  /** Fill of each stage, 0…1, in scan / copy / covers order. */
  fills: [number, number, number];
  /** The stage working right now, or null. It may sit at fill 0 and still be
   * working — beets reports nothing until it takes the first folder. */
  activeIndex: number | null;
  failedIndex: number | null;
  tone: RailTone;
  /** The stage the phase line names, or null when nothing is running. */
  stage: ImportStage | null;
}

/** A ratio that never divides by zero and never overshoots the segment. Beets
 * groups by what it finds in the files rather than by folder, so it can announce
 * more steps than the walk counted. */
function ratio(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

export function importRail(phase: ImportPhase, progress: ImportProgress | null): ImportRail {
  switch (phase.kind) {
    case "empty":
      return { fills: [0, 0, 0], activeIndex: null, failedIndex: null, tone: "accent", stage: null };

    case "scanning":
      return { fills: [0, 0, 0], activeIndex: 0, failedIndex: null, tone: "accent", stage: "scan" };

    case "scanFailed":
      return { fills: [0, 0, 0], activeIndex: null, failedIndex: 0, tone: "danger", stage: "scan" };

    case "scanned":
      // Read, and waiting on the user: the first stage is done and no other has
      // started, which is exactly what the bar should say.
      return { fills: [1, 0, 0], activeIndex: null, failedIndex: null, tone: "accent", stage: null };

    case "importing": {
      if (progress?.stage === "covers") {
        return {
          fills: [1, 1, ratio(progress.done, progress.total)],
          activeIndex: 2,
          failedIndex: null,
          tone: "accent",
          stage: "covers",
        };
      }
      const copied = progress?.stage === "copying" ? ratio(progress.folders, phase.report.albumFolders) : 0;
      return { fills: [1, copied, 0], activeIndex: 1, failedIndex: null, tone: "accent", stage: "copy" };
    }

    case "importFailed":
      // The scan did run; the copy is drawn empty in the failure colour, and the
      // cover pass is not drawn at all — it never got the chance.
      return { fills: [1, 0, 0], activeIndex: null, failedIndex: 1, tone: "danger", stage: "copy" };

    case "importCancelled": {
      // Stopped on purpose, so amber — the app's "not quite complete", never
      // "failed". The copy segment holds how far it actually got: the outcome
      // counts folders and the report knows the total. The cover pass did run
      // over what landed, so its segment is full, not abandoned.
      const copied = phase.report ? ratio(phase.outcome.folders, phase.report.albumFolders) : 0;
      return { fills: [1, copied, 1], activeIndex: null, failedIndex: null, tone: "warning", stage: null };
    }

    case "imported":
      return { fills: [1, 1, 1], activeIndex: null, failedIndex: null, tone: "success", stage: null };
  }
}
