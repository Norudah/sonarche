import { Check, FolderCheck, FolderInput, FolderOpen, FolderSearch, FolderX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ImportProgress } from "@/features/import/hooks";
import type { ImportPhase } from "@/features/import/phase";
import { PhaseDetail } from "@/features/import/PhaseDetail";
import { importRail, STAGE_WEIGHTS } from "@/features/import/stages";
import { StageLabels } from "@/features/import/StageLabels";
import { useImportLabel } from "@/features/import/useImportLabel";
import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";
import { PipelineRail } from "@/shared/ui/PipelineRail";
import { Verdict, type VerdictTone } from "@/shared/ui/Verdict";

interface ImportCardProps {
  folder: string | null;
  phase: ImportPhase;
  progress: ImportProgress | null;
}

/** The face of the folder as it goes through the pipeline: which glyph, and on
 * what tint. The tile is what carries the verdict's colour — a card that turns
 * green at the bottom and stays indigo at the top has two opinions. */
const FACE: Record<ImportPhase["kind"], { icon: LucideIcon; tile: string }> = {
  empty: { icon: FolderOpen, tile: "bg-default text-muted" },
  scanning: { icon: FolderSearch, tile: "bg-accent-soft text-accent" },
  scanFailed: { icon: FolderX, tile: "bg-danger-soft text-danger" },
  scanned: { icon: FolderCheck, tile: "bg-accent-soft text-accent" },
  importing: { icon: FolderInput, tile: "bg-accent-soft text-accent" },
  importFailed: { icon: FolderX, tile: "bg-danger-soft text-danger" },
  imported: { icon: Check, tile: "bg-success-soft text-success" },
};

const VERDICT: Partial<Record<ImportPhase["kind"], { tone: VerdictTone; key: string }>> = {
  scanned: { tone: "accent", key: "verdict.ready" },
  imported: { tone: "success", key: "verdict.done" },
  scanFailed: { tone: "danger", key: "verdict.failed" },
  importFailed: { tone: "danger", key: "verdict.failed" },
};

/**
 * The import as the download feed would show it: one card on a tray, with the
 * artwork tile, the name, a line saying where it is, and the rail underneath.
 *
 * It is on screen before anything happens, holding an empty rail with its three
 * stages named. That is deliberate — the page used to be a lone button on white,
 * and someone landing on it had no idea what pressing it would set off. An empty
 * rail is a promise; a blank page is a shrug.
 */
export function ImportCard({ folder, phase, progress }: ImportCardProps) {
  const { t } = useTranslation("import");
  const rail = importRail(phase, progress);
  const label = useImportLabel(phase, progress);

  const face = FACE[phase.kind];
  const verdict = VERDICT[phase.kind];
  // The folder's own name, not its path: the path is up in the picker, and what
  // this card is about is the thing being copied.
  const name = folder?.split(/[/\\]/).filter(Boolean).at(-1);

  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
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

          {/* The stage cross-fades, the counter does not — see `useImportLabel`
              for why that split is what stopped the card jumping. `cross` and
              not `wait`: the two versions share one grid cell, so the line's
              box never collapses between them. */}
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

        <div className="flex w-24 shrink-0 justify-end">
          {verdict && <Verdict tone={verdict.tone}>{t(verdict.key)}</Verdict>}
        </div>
      </div>

      <PhaseDetail phase={phase} progress={progress} />
    </article>
  );
}
