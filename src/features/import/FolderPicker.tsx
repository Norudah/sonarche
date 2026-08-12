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

/**
 * Naming the folder, and only that.
 *
 * It used to carry the Import button too, on the composer's grammar — field on
 * the left, commit point on the right. But the composer commits a *link*, which
 * has no life of its own, while an import is a thing that then happens on a card
 * further down the page: pressing here started something the eye had to go find,
 * and the card that owned the run was the one place with no way to start it. The
 * button moved there. What is left is the field, which is the choice this panel
 * is actually about.
 *
 * The field is a button because the path cannot be typed — the OS panel is the
 * only way to name a folder — but it reads as a field on purpose: the two ways
 * music enters the ark should feel like the same gesture.
 */
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
          {/* Recognising the folder is this panel's first act, reported where
              the folder is — the neutral open folder becomes the accent one the
              moment a path lands, exactly as the composer's chain link becomes
              the audio mark. */}
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

      {/* The strip the composer uses for its options. There is nothing to
          configure here, so it carries the one thing worth repeating — that the
          originals are not touched — and, once the copy has landed, the way on. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-separator/60 bg-panel px-4 py-2.5">
        <p className="text-xs text-muted">{t("hint")}</p>
        {/* A cancelled run keeps the door too: whatever landed before the stop
            is browsable, and this link is how the user goes and sees it. */}
        {(phase.kind === "imported" || (phase.kind === "importCancelled" && phase.outcome.folders > 0)) && (
          <ActionLink to={paths.libraryTracks} trailingIcon={ArrowRight}>
            {t("seeLibrary")}
          </ActionLink>
        )}
      </div>
    </div>
  );
}
