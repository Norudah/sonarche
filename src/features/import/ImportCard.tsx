import { Button } from "@heroui/react";
import { Check, FolderCheck, FolderInput, FolderOpen, FolderSearch, FolderX, Square } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Grouping } from "@/features/import/api";
import type { ImportProgress } from "@/features/import/hooks";
import { ImportOptions } from "@/features/import/ImportOptions";
import type { ImportPhase } from "@/features/import/phase";
import { PhaseDetail } from "@/features/import/PhaseDetail";
import { importRail, STAGE_WEIGHTS } from "@/features/import/stages";
import { StageLabels } from "@/features/import/StageLabels";
import { useImportLabel } from "@/features/import/useImportLabel";
import { Swap } from "@/shared/motion/Swap";
import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";
import { springs } from "@/shared/motion/tokens";
import { PipelineRail } from "@/shared/ui/PipelineRail";
import { Verdict, type VerdictTone } from "@/shared/ui/Verdict";

interface ImportCardProps {
  folder: string | null;
  phase: ImportPhase;
  progress: ImportProgress | null;
  grouping: Grouping;
  category: string | null;
  onStart: () => void;
  onGroupingChange: (grouping: Grouping) => void;
  onCategoryChange: (category: string | null) => void;
  onCancel: () => void;
  isCancelling: boolean;
}

/** Glyph and tint per phase; the tile carries the verdict's colour. */
const FACE: Record<ImportPhase["kind"], { icon: LucideIcon; tile: string }> = {
  empty: { icon: FolderOpen, tile: "bg-default text-muted" },
  scanning: { icon: FolderSearch, tile: "bg-accent-soft text-accent" },
  scanFailed: { icon: FolderX, tile: "bg-danger-soft text-danger" },
  scanned: { icon: FolderCheck, tile: "bg-accent-soft text-accent" },
  importing: { icon: FolderInput, tile: "bg-accent-soft text-accent" },
  importFailed: { icon: FolderX, tile: "bg-danger-soft text-danger" },
  // Amber: a stop is the user's choice, and what landed is kept.
  importCancelled: { icon: Square, tile: "bg-warning-soft text-warning" },
  imported: { icon: Check, tile: "bg-success-soft text-success" },
};

/* No verdict for `scanned`: the Import button already says it's ready. */
const VERDICT: Partial<Record<ImportPhase["kind"], { tone: VerdictTone; key: string }>> = {
  imported: { tone: "success", key: "verdict.done" },
  importCancelled: { tone: "warning", key: "verdict.cancelled" },
  scanFailed: { tone: "danger", key: "verdict.failed" },
  importFailed: { tone: "danger", key: "verdict.failed" },
};

/** The import as a single job card, shown with its empty rail before anything
 * starts so the page says what it will do. */
export function ImportCard({
  folder,
  phase,
  progress,
  grouping,
  category,
  onStart,
  onGroupingChange,
  onCategoryChange,
  onCancel,
  isCancelling,
}: ImportCardProps) {
  const { t } = useTranslation("import");
  const rail = importRail(phase, progress);
  const label = useImportLabel(phase, progress);
  const canStart = phase.kind === "scanned" || phase.kind === "importFailed";
  // On the wrapper: HeroUI's Button owns its transform.
  const startRef = usePopOnActivate<HTMLDivElement>(canStart);

  const face = FACE[phase.kind];
  const verdict = VERDICT[phase.kind];
  // The folder name; the full path is in the picker.
  const name = folder?.split(/[/\\]/).filter(Boolean).at(-1);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <div className={`flex size-16 shrink-0 items-center justify-center rounded-xl transition-colors ${face.tile}`}>
          <Swap
            swapKey={phase.kind}
            mode="cross"
            animate={{ opacity: 1, scale: [0.85, 1] }}
            transition={springs.bouncy}
          >
            <face.icon className="size-6" />
          </Swap>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={"min-w-0 truncate text-[0.9375rem] font-semibold " + (name == null ? "text-muted" : "")}>
            {name ?? t("choosePlaceholder")}
          </p>

          {/* Only the stage cross-fades, not the counter (see `useImportLabel`). */}
          <p className="flex min-w-0 items-baseline gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted">
            <Swap swapKey={label.phase} mode="cross">
              {label.phase}
            </Swap>
            {label.counter != null && <span className="tabular-nums">· {label.counter}</span>}
          </p>

          <div className="mt-1.5 flex flex-col gap-1.5">
            <PipelineRail
              fills={rail.fills}
              weights={STAGE_WEIGHTS}
              activeIndex={rail.activeIndex}
              failedIndex={rail.failedIndex}
              tone={rail.tone}
              label={label.text}
            />
            <StageLabels rail={rail} />
          </div>
        </div>

        {/* One slot: start, stop, then the verdict. Fixed width so the edge doesn't shift. */}
        <div className="flex w-32 shrink-0 justify-end">
          {canStart ? (
            <div ref={startRef} className="flex">
              <Button
                type="button"
                variant="primary"
                onPress={onStart}
                className="rounded-xl px-5 transition-transform active:scale-[0.97]"
              >
                {phase.kind === "importFailed" ? t("retry") : t("start")}
              </Button>
            </div>
          ) : phase.kind === "importing" && progress?.stage !== "covers" ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40"
            >
              <Square className="size-3.5" />
              {t("stop")}
            </button>
          ) : (
            verdict && <Verdict tone={verdict.tone}>{t(verdict.key)}</Verdict>
          )}
        </div>
      </div>

      <ImportOptions
        grouping={grouping}
        category={category}
        report={"report" in phase ? phase.report : null}
        isDisabled={phase.kind === "importing"}
        onGroupingChange={onGroupingChange}
        onCategoryChange={onCategoryChange}
      />

      <PhaseDetail phase={phase} progress={progress} />
    </article>
  );
}
