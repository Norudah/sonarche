import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { ScanSummary } from "@/features/import/ScanSummary";
import { hasAudio } from "@/features/import/summary";
import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";

/**
 * What is known about the folder right now, under the card's own rail.
 *
 * Height, not opacity: the card has to grow into its content rather than have a
 * summary appear on top of the page below it — same reasoning as an unfolded job
 * card in the download feed, and the same spring, so the two read as one app.
 */
export function PhaseDetail({ phase, progress }: { phase: ImportPhase; progress: ImportProgress | null }) {
  const body = <Body phase={phase} progress={progress} />;

  return (
    // `mode="wait"` and a key per phase: one phase's detail collapses before the
    // next expands, so the card resizes once instead of jumping to the new
    // content's height mid-transition.
    <AnimatePresence initial={false} mode="wait">
      {phase.kind !== "empty" && phase.kind !== "scanning" && (
        <motion.div
          key={phase.kind}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springs.soft}
          className="overflow-hidden"
        >
          <div className="border-t border-separator/60 pt-4">{body}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Body({ phase, progress }: { phase: ImportPhase; progress: ImportProgress | null }): ReactNode {
  const { t } = useTranslation("import");

  switch (phase.kind) {
    case "empty":
    case "scanning":
      return null;

    case "scanFailed":
      return <Failure title={t("scanFailed")} message={phase.message} />;

    case "scanned":
      return <ScanSummary report={phase.report} />;

    case "importing":
      // The summary stays up through the copy. It is what the user agreed to,
      // and a card that shrinks to one line the moment work starts reads as
      // having thrown the answer away.
      return (
        <div className="flex flex-col gap-4">
          <CopyingLine progress={progress} />
          <ScanSummary report={phase.report} />
        </div>
      );

    case "importFailed":
      return (
        <div className="flex flex-col gap-4">
          <Failure title={t("importFailed")} message={phase.message} />
          {/* Still shown: what was in the folder has not changed, and a retry
              is about the same contents. */}
          {hasAudio(phase.report) && <ScanSummary report={phase.report} />}
        </div>
      );

    case "imported":
      return (
        <div className="flex flex-col gap-0.5">
          <p className="text-[0.8125rem]">{t("doneDetail", { count: phase.outcome.folders })}</p>
          {phase.outcome.renditions > 0 && (
            <p className="text-[0.8125rem] text-muted">{t("doneRenditions", { count: phase.outcome.renditions })}</p>
          )}
        </div>
      );
  }
}

/**
 * The one line that moves while beets works: which album is being copied, or —
 * on the cover pass, which counts something else entirely — why the app is
 * still busy after the copy looked finished.
 */
function CopyingLine({ progress }: { progress: ImportProgress | null }) {
  const { t } = useTranslation("import");

  const text =
    progress == null
      ? null
      : progress.stage === "covers"
        ? t("shrinkingWhy")
        : (progress.folder?.split(/[/\\]/).filter(Boolean).at(-1) ?? null);

  if (text == null) return null;

  return (
    <Swap swapKey={text} className="block truncate text-[0.8125rem] text-muted">
      {text}
    </Swap>
  );
}

function Failure({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="text-[0.8125rem] break-words text-muted">{message}</p>
    </div>
  );
}
