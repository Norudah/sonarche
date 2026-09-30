import { ArrowRight, FolderOpen, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import type { ImportPhase } from "@/features/import/phase";
import { shortenPath } from "@/features/import/summary";
import { Swap } from "@/shared/motion/Swap";
import { ActionLink } from "@/shared/ui/ActionLink";

interface FolderPickerProps {
  folder: string | null;
  phase: ImportPhase;
  onChoose: () => void;
}

/** The folder field. A button (paths come from the OS picker) styled like the
 * download composer's field. */
export function FolderPicker({ folder, phase, onChoose }: FolderPickerProps) {
  const { t } = useTranslation("import");

  const busy = phase.kind === "importing";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-accent/40">
      <div className="flex items-stretch gap-2 p-2">
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          aria-label={t("chooseLabel")}
          className="group/field flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors outline-none hover:bg-default/50 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-60"
        >
          {/* The folder icon turns accent once a path is chosen, like the composer's link icon. */}
          <Swap swapKey={folder != null ? "chosen" : "idle"} mode="cross" className="flex">
            {folder != null ? (
              <FolderSearch className="size-[1.125rem] text-accent" />
            ) : (
              <FolderOpen className="size-4 text-muted" />
            )}
          </Swap>

          <span className={"min-w-0 flex-1 truncate text-sm " + (folder == null ? "text-muted" : "")}>
            {folder != null ? shortenPath(folder) : t("choosePlaceholder")}
          </span>

          <span className="shrink-0 text-xs font-medium text-muted transition-colors group-hover/field:text-accent">
            {t("chooseHint")}
          </span>
        </button>
      </div>

      {/* Reassures that originals are untouched, then links onward after the copy. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-separator/60 bg-panel px-4 py-2.5">
        <p className="text-xs text-muted">{t("hint")}</p>
        {/* Cancelled runs too: what landed is browsable. */}
        {(phase.kind === "imported" || (phase.kind === "importCancelled" && phase.outcome.folders > 0)) && (
          <ActionLink to={paths.libraryTracks} trailingIcon={ArrowRight}>
            {t("seeLibrary")}
          </ActionLink>
        )}
      </div>
    </div>
  );
}
