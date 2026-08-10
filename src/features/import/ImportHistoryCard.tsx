import { ChevronDown, FolderInput, FolderX, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ImportRecord } from "@/features/import/api";
import { ImportRecapPanel } from "@/features/import/ImportRecapPanel";
import { shortenPath } from "@/features/import/summary";
import { useImportHeadline } from "@/features/import/useImportHeadline";
import { springs } from "@/shared/motion/tokens";
import { Verdict } from "@/shared/ui/Verdict";

/** The folder's own name — the path is in the panel, and what the row is about
 * is the collection that came in. */
function nameOf(folder: string): string {
  return folder.split(/[/\\]/).filter(Boolean).at(-1) ?? folder;
}

/**
 * One finished import in the archive.
 *
 * Deliberately the same object as a filed download: the tile, the name, the one
 * line under it, the verdict on the same vertical line, and a panel that unfolds
 * where the depth lives. The two are the two ways music enters the ark and a
 * row of one must not read as a different kind of thing from a row of the other
 * — which is the mistake the history made when downloads were a table.
 *
 * The columns are reserved to the same widths as a job row even though an
 * archived import offers no action: the two sections sit one above the other,
 * and every row's verdict has to land on the same line down the page.
 */
export function ImportHistoryCard({ record }: { record: ImportRecord }) {
  const { t, i18n } = useTranslation("import");
  const [isOpen, setIsOpen] = useState(false);

  const failed = record.status === "failed";
  const cancelled = record.status === "cancelled";
  const headline = useImportHeadline(record.folders, record.scan, record.recap);
  const subtitle = failed ? record.error : headline;

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
            (failed
              ? "bg-danger-soft text-danger"
              : cancelled
                ? "bg-warning-soft text-warning"
                : "bg-accent-soft text-accent")
          }
        >
          {failed ? (
            <FolderX className="size-4" />
          ) : cancelled ? (
            <Square className="size-4" />
          ) : (
            <FolderInput className="size-4" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="min-w-0 truncate text-sm font-semibold">{nameOf(record.folder)}</p>
          <p className={"min-w-0 truncate text-xs " + (failed ? "text-danger" : "text-muted")} title={subtitle ?? ""}>
            {subtitle}
          </p>
        </div>

        <div className="flex w-28 shrink-0 justify-end">
          <Verdict tone={failed ? "danger" : cancelled ? "warning" : "success"}>
            {t(failed ? "verdict.failed" : cancelled ? "verdict.cancelled" : "verdict.done")}
          </Verdict>
        </div>

        <div className="w-32 shrink-0" />

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

      {/* Height, not opacity alone: the rows under this one have to move out of
          the way, same as a job card's panel. */}
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
                {/* The app's only rendered date, and it earns its place here:
                    imports are rare and far apart, so "which one was this" is a
                    question the archive has to answer. */}
                <p className="text-xs text-muted">
                  {new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" }).format(
                    record.finishedAt,
                  )}
                </p>
              </div>

              {failed ? (
                <p className="text-[0.8125rem] break-words text-danger">{record.error}</p>
              ) : (
                <ImportRecapPanel renditions={record.renditions} scan={record.scan} recap={record.recap} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
