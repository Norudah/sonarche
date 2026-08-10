import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { ImportRecapPanel } from "@/features/import/ImportRecapPanel";
import { ScanSummary } from "@/features/import/ScanSummary";
import { hasAudio } from "@/features/import/summary";
import { useImportHeadline } from "@/features/import/useImportHeadline";
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
    case "importCancelled":
      // The same panel the archive shows, not a shorter version of it: what an
      // import brought in is one set of facts, and the page that just ran it is
      // exactly where they matter most. A cancelled run shares it — what
      // landed before the stop is in the library and deserves the same recap.
      return <Landed phase={phase} />;
  }
}

/**
 * The import, over. The count of what came in leads, then the panel — its own
 * component because the headline is a hook, and the switch above is a plain
 * function that cannot call one.
 */
function Landed({ phase }: { phase: Extract<ImportPhase, { kind: "imported" | "importCancelled" }> }) {
  const { t } = useTranslation("import");
  const headline = useImportHeadline(phase.outcome.folders, phase.report, phase.outcome.recap);
  const cancelled = phase.kind === "importCancelled";

  // Stopped before anything was taken on: there is nothing to recap, and a
  // panel of zeroes would dress an empty act as a result.
  if (cancelled && phase.outcome.folders === 0 && phase.outcome.recap == null) {
    return <p className="text-[0.8125rem] text-muted">{t("cancelledNothing")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.8125rem]">{cancelled ? t("cancelledDetail", { landed: headline }) : headline}</p>
      <ImportRecapPanel renditions={phase.outcome.renditions} scan={phase.report} recap={phase.outcome.recap} />
    </div>
  );
}

/**
 * The one line that moves while beets works: which album is being copied, or —
 * on the cover pass, which counts something else entirely — why the app is
 * still busy after the copy looked finished.
 *
 * Not animated, and always rendered. A name that is replaced a dozen times in
 * as many seconds is a readout going past, not a state landing: it used to
 * cross-fade, which took the line out of the DOM and put it back on every album
 * and made the whole card breathe. The fixed height is the other half of that —
 * before the first tick there is nothing to say, and an empty line has to hold
 * its place rather than let the card grow into it a beat later.
 */
function CopyingLine({ progress }: { progress: ImportProgress | null }) {
  const { t } = useTranslation("import");

  const text =
    progress == null
      ? null
      : progress.stage === "covers"
        ? t("shrinkingWhy")
        : (progress.folder?.split(/[/\\]/).filter(Boolean).at(-1) ?? null);

  return <p className="h-5 truncate text-[0.8125rem] leading-5 text-muted">{text}</p>;
}

function Failure({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="text-[0.8125rem] break-words text-muted">{message}</p>
    </div>
  );
}
