import { ChevronDown, FolderInput, FolderX, Square, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ImportRecord } from "@/features/import/api";
import { ImportRecapPanel } from "@/features/import/ImportRecapPanel";
import { ImportUndoAction } from "@/features/import/ImportUndoAction";
import { shortenPath } from "@/features/import/summary";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useImportHeadline } from "@/features/import/useImportHeadline";
import { springs } from "@/shared/motion/tokens";
import { Verdict } from "@/shared/ui/Verdict";

function nameOf(folder: string): string {
  return folder.split(/[/\\]/).filter(Boolean).at(-1) ?? folder;
}

/** One archived import, shaped like a filed download card. */
export function ImportHistoryCard({ record }: { record: ImportRecord }) {
  const { t, i18n } = useTranslation("import");
  const categoryLabel = useCategoryLabel();
  const [isOpen, setIsOpen] = useState(false);

  const failed = record.status === "failed";
  const cancelled = record.status === "cancelled";
  // Undone outranks the status on the closed row.
  const undone = record.undoneAt != null;
  const headline = useImportHeadline(record.folders, record.scan, record.recap);
  const subtitle = failed ? record.error : undone ? t("undo.subtitle") : headline;

  return (
    <article
      className={
        "rounded-xl px-3 py-2.5 " + (isOpen ? "bg-surface shadow-sm" : "transition-colors hover:bg-default/50")
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg " +
            (undone
              ? "bg-default text-muted"
              : failed
                ? "bg-danger-soft text-danger"
                : cancelled
                  ? "bg-warning-soft text-warning"
                  : "bg-accent-soft text-accent")
          }
        >
          {undone ? (
            <Undo2 className="size-4" />
          ) : failed ? (
            <FolderX className="size-4" />
          ) : cancelled ? (
            <Square className="size-4" />
          ) : (
            <FolderInput className="size-4" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{nameOf(record.folder)}</p>
            {/* The chosen grouping, visible without unfolding. */}
            {record.grouping && (
              <span className="shrink-0 rounded-full bg-default/70 px-2 py-0.5 text-[0.625rem] font-medium text-muted">
                {t(`grouping.${record.grouping}`)}
              </span>
            )}
          </div>
          <p className={"min-w-0 truncate text-xs " + (failed ? "text-danger" : "text-muted")} title={subtitle ?? ""}>
            {subtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Verdict tone={undone ? "accent" : failed ? "danger" : cancelled ? "warning" : "success"}>
            {t(undone ? "undo.verdict" : failed ? "verdict.failed" : cancelled ? "verdict.cancelled" : "verdict.done")}
          </Verdict>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={t(isOpen ? "recap.collapse" : "recap.expand")}
            onClick={() => setIsOpen((open) => !open)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors outline-none hover:bg-default/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <motion.span initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={springs.snappy}>
              <ChevronDown className="size-4" />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Height, so the rows below move. */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.soft}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs break-all text-muted" title={record.folder}>
                  {shortenPath(record.folder)}
                </p>
                {/* Imports are rare, so the date helps tell them apart. */}
                <p className="text-xs text-muted">
                  {new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" }).format(
                    record.finishedAt,
                  )}
                </p>
              </div>

              {(record.grouping || record.category) && (
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {record.grouping && (
                    <div className="flex gap-1.5">
                      <dt className="text-muted">{t("grouping.label")}</dt>
                      <dd>{t(`grouping.${record.grouping}Answer`)}</dd>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <dt className="text-muted">{t("category.label")}</dt>
                    <dd>{record.category ? categoryLabel(record.category) : t("category.none")}</dd>
                  </div>
                </dl>
              )}

              {failed ? (
                <p className="text-[0.8125rem] break-words text-danger">{record.error}</p>
              ) : (
                <ImportRecapPanel renditions={record.renditions} scan={record.scan} recap={record.recap} alignDoor />
              )}

              {/* Only in the unfolded panel, never on the closed row. */}
              {!undone && <ImportUndoAction id={record.id} name={nameOf(record.folder)} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
