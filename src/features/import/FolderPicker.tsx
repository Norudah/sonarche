import { Button } from "@heroui/react";
import { ArrowRight, FolderOpen, FolderSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import type { ImportPhase } from "@/features/import/phase";
import { shortenPath } from "@/features/import/summary";
import { Swap } from "@/shared/motion/Swap";
import { usePopOnActivate } from "@/shared/motion/usePopOnActivate";
import { ActionLink } from "@/shared/ui/ActionLink";

interface FolderPickerProps {
  folder: string | null;
  phase: ImportPhase;
  onChoose: () => void;
  onStart: () => void;
}

/**
 * The one control this page exists for, built to the download composer's
 * grammar: a lifted panel holding the whole decision, a field on the left, the
 * commit point on the right, and a tinted strip underneath.
 *
 * The field is a button because the path cannot be typed — the OS panel is the
 * only way to name a folder — but it reads as a field on purpose: the two ways
 * music enters the ark should feel like the same gesture, and a page whose only
 * affordance was a lone "Choisir un dossier…" button read as a dialog that had
 * lost its dialog.
 */
export function FolderPicker({ folder, phase, onChoose, onStart }: FolderPickerProps) {
  const { t } = useTranslation("import");

  const canStart = phase.kind === "scanned" || phase.kind === "importFailed";
  const busy = phase.kind === "importing";
  // Same treatment as the composer's Download button: it swells the moment the
  // form becomes submittable. On the wrapper rather than the Button, because
  // `usePopOnActivate` writes a transform and HeroUI's Button owns its own.
  const startRef = usePopOnActivate<HTMLDivElement>(canStart);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-accent/40">
      {/* `items-stretch`, not `items-center`: the field's height comes from its
          own padding and the button's from its size variant, and the two never
          matched. */}
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
              YouTube's mark. */}
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

        <div ref={startRef} className="flex shrink-0">
          <Button
            type="button"
            variant="primary"
            onPress={onStart}
            isDisabled={!canStart}
            isPending={busy}
            className="h-full rounded-xl px-5 transition-transform active:scale-[0.97]"
          >
            {phase.kind === "importFailed" ? t("retry") : t("start")}
          </Button>
        </div>
      </div>

      {/* The strip the composer uses for its options. There is nothing to
          configure here, so it carries the one thing worth repeating — that the
          originals are not touched — and, once the copy has landed, the way on. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-separator/60 bg-panel px-4 py-2.5">
        <p className="text-xs text-muted">{t("hint")}</p>
        {phase.kind === "imported" && (
          <ActionLink to={paths.libraryTracks} trailingIcon={ArrowRight}>
            {t("seeLibrary")}
          </ActionLink>
        )}
      </div>
    </div>
  );
}
