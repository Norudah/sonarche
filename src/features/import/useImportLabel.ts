import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { importRail } from "@/features/import/stages";

/**
 * The import's progress in words, split into `phase` (animated, changes three
 * times) and `counter` (never animated: cross-fading it made the card jump on
 * every folder). `text` joins both for the rail's `aria-valuetext`.
 */
interface ImportLabel {
  phase: string;
  counter: string | null;
  /** Both, for assistive tech. */
  text: string;
}

export function useImportLabel(phase: ImportPhase, progress: ImportProgress | null): ImportLabel {
  const { t } = useTranslation("import");
  const { stage } = importRail(phase, progress);

  const still = (key: string): ImportLabel => ({ phase: t(key), counter: null, text: t(key) });

  switch (phase.kind) {
    case "empty":
      return still("phase.idle");
    case "scanning":
      return still("scanning");
    case "scanFailed":
      return still("scanFailed");
    case "scanned":
      return still("phase.ready");
    case "importFailed":
      return still("importFailed");
    case "importCancelled":
      return still("cancelled");
    case "imported":
      return still("done");
    case "importing": {
      const name = t(`stages.${stage ?? "copy"}`);
      const counter =
        progress?.stage === "covers"
          ? t("coversProgress", { done: progress.done, total: progress.total })
          : progress?.stage === "copying"
            ? t("progress", { done: progress.folders, total: phase.report.albumFolders })
            : null;
      return { phase: name, counter, text: counter == null ? name : `${name} · ${counter}` };
    }
  }
}
