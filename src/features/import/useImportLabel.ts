import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { importRail } from "@/features/import/stages";

/**
 * Where the import has got to, in words — "Copie · Dossier 3 sur 12".
 *
 * A hook rather than a formatter inside the card, because the same string is
 * both the visible line under the folder name and the rail's `aria-valuetext`:
 * a progress bar that announces "43" tells a screen reader nothing, and the two
 * must not be allowed to drift into saying different things. Same contract as
 * the download feed's `useProgressLabel`.
 */
export function useImportLabel(phase: ImportPhase, progress: ImportProgress | null): string {
  const { t } = useTranslation("import");
  const { stage } = importRail(phase, progress);

  switch (phase.kind) {
    case "empty":
      return t("phase.idle");
    case "scanning":
      return t("scanning");
    case "scanFailed":
      return t("scanFailed");
    case "scanned":
      return t("phase.ready");
    case "importFailed":
      return t("importFailed");
    case "imported":
      return t("done");
    case "importing": {
      const name = t(`stages.${stage ?? "copy"}`);
      if (progress?.stage === "covers") {
        return `${name} · ${t("coversProgress", { done: progress.done, total: progress.total })}`;
      }
      if (progress?.stage === "copying") {
        return `${name} · ${t("progress", { done: progress.folders, total: phase.report.albumFolders })}`;
      }
      return name;
    }
  }
}
