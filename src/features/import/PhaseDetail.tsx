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

/** Phases sharing a key show the same body, so `mode="wait"` doesn't collapse
 * and reopen the card between them. */
export const DETAIL_KEY: Partial<Record<ImportPhase["kind"], string>> = {
  scanned: "summary",
  importing: "summary",
  imported: "landed",
  importCancelled: "landed",
  scanFailed: "failure",
  importFailed: "failure",
};

/** Details under the rail; animates height like an unfolded job card. */
export function PhaseDetail({ phase, progress }: { phase: ImportPhase; progress: ImportProgress | null }) {
  const body = <Body phase={phase} progress={progress} />;

  return (
    <AnimatePresence initial={false} mode="wait">
      {phase.kind !== "empty" && phase.kind !== "scanning" && (
        <motion.div
          key={DETAIL_KEY[phase.kind] ?? phase.kind}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springs.soft}
          className="overflow-hidden"
        >
          <div className="border-t border-separator/60 p-4">{body}</div>
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

    // The summary stays up during the copy; the copying line appears only while copying.
    case "scanned":
      return <ScanSummary report={phase.report} />;

    case "importing":
      return (
        <div className="flex flex-col gap-3">
          <CopyingLine progress={progress} />
          <ScanSummary report={phase.report} />
        </div>
      );

    case "importFailed":
      return (
        <div className="flex flex-col gap-4">
          <Failure title={t("importFailed")} message={phase.message} />
          {/* A retry concerns the same contents. */}
          {hasAudio(phase.report) && <ScanSummary report={phase.report} />}
        </div>
      );

    case "imported":
    case "importCancelled":
      // Same recap as the archive; cancelled runs share it.
      return <Landed phase={phase} />;
  }
}

/** A component because the headline is a hook. */
function Landed({ phase }: { phase: Extract<ImportPhase, { kind: "imported" | "importCancelled" }> }) {
  const { t } = useTranslation("import");
  const headline = useImportHeadline(phase.outcome.folders, phase.report, phase.outcome.recap);
  const cancelled = phase.kind === "importCancelled";

  // Nothing landed: no recap of zeroes.
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

/** The album being copied, or why the cover pass is still busy. Not animated
 * (it changes too often), with a fixed height so the card doesn't grow later. */
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
