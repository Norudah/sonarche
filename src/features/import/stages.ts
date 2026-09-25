/** The import as three rail stages: scan, copy, covers. */

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import type { RailTone } from "@/shared/ui/PipelineRail";

export const IMPORT_STAGES = ["scan", "copy", "covers"] as const;
export type ImportStage = (typeof IMPORT_STAGES)[number];

/** Relative widths: the copy is most of the work. */
export const STAGE_WEIGHTS = [2, 5, 2] as const;

export interface ImportRail {
  /** 0…1 per stage: scan, copy, covers. */
  fills: [number, number, number];
  /** May be active at fill 0 (beets reports nothing before the first folder). */
  activeIndex: number | null;
  failedIndex: number | null;
  tone: RailTone;
  /** Named in the phase line; null when idle. */
  stage: ImportStage | null;
}

/** Clamped: beets can report more steps than the scan counted folders. */
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
      // Scanned, waiting on the user.
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
      // The copy failed; the cover pass never ran.
      return { fills: [1, 0, 0], activeIndex: null, failedIndex: 1, tone: "danger", stage: "copy" };

    case "importCancelled": {
      // Amber for a stop. The cover pass still ran over what landed.
      const copied = phase.report ? ratio(phase.outcome.folders, phase.report.albumFolders) : 0;
      return { fills: [1, copied, 1], activeIndex: null, failedIndex: null, tone: "warning", stage: null };
    }

    case "imported":
      return { fills: [1, 1, 1], activeIndex: null, failedIndex: null, tone: "success", stage: null };
  }
}
