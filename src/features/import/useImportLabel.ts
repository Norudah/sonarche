import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { importRail } from "@/features/import/stages";

/**
 * Where the import has got to, in words — "Copie" and "Dossier 3 sur 12".
 *
 * Split in two rather than returned as one string, and that is the whole point.
 * The phase is a state: it changes three times in an import and each change is
 * worth animating. The counter is a *readout*: it changes once per album folder,
 * and cross-fading it meant the line left the DOM and came back on every tick —
 * `AnimatePresence` in `wait` mode has one commit with no child, so the card lost
 * a line's height and got it back, dozens of times, while a second copy of the
 * same trick ran on the folder name below. That was the card jumping.
 *
 * `text` is the pair joined, and it is not for the eye: it is the rail's
 * `aria-valuetext`, because a progress bar announcing "43" tells a screen reader
 * nothing. The two must not be allowed to drift into saying different things,
 * which is why one hook owns both. Same contract as the download feed's
 * `useProgressLabel`.
 */
export interface ImportLabel {
  /** The stage, or the sentence a still phase is described by. Animated. */
  phase: string;
  /** How far through that stage, when it counts something. Never animated. */
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
