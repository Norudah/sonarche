import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ConvertReport } from "@/features/settings/api";
import type { AudioFormat } from "@/features/settings/audioFormats";
import type { ConvertProgress } from "@/features/settings/hooks";

/**
 * The one modal in the app that is allowed to hold someone still.
 *
 * Everything else that takes a while — a download, an import, a genre
 * recompute — runs behind a toast and lets the user keep browsing. This cannot:
 * the pass deletes each original the moment its replacement lands, so a track
 * being converted is a track that exists in exactly one place for a few
 * hundred milliseconds. Playing it, moving it, editing its tags or erasing the
 * library while that is true is a race the app would lose quietly. Standing
 * still is the honest answer, and saying so up front is the price of asking.
 *
 * Three phases in one dialog, and the geometry barely moves between them —
 * warn, work, report. A separate "done" dialog would flash the backdrop and
 * read as a second question.
 */
export function ConvertLibraryDialog({
  isOpen,
  format,
  progress,
  report,
  error,
  isRunning,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  format: AudioFormat;
  progress: ConvertProgress | null;
  report: ConvertReport | null;
  error: string | null;
  isRunning: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("settings");
  const label = t(`adding.audioFormat.formats.${format}.name`);
  const done = report != null || error != null;
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        // A pass in flight owns the screen: no backdrop click, no Escape, no
        // way back to a library whose files are moving underneath it.
        if (!open && !isRunning) onClose();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="rounded-2xl">
            <AlertDialog.Icon status={done && !error ? "success" : "warning"} className="rounded-xl">
              {done && !error ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
            </AlertDialog.Icon>
            <AlertDialog.Header>
              <AlertDialog.Heading className="text-lg font-semibold tracking-tight">
                {done
                  ? t("adding.audioFormat.convert.doneTitle")
                  : t("adding.audioFormat.convert.title", { format: label })}
              </AlertDialog.Heading>
            </AlertDialog.Header>

            <AlertDialog.Body className="text-sm leading-relaxed text-muted">
              {!isRunning && !done && (
                <>
                  <p>{t("adding.audioFormat.convert.intro", { format: label })}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>{t("adding.audioFormat.convert.warnings.time")}</li>
                    <li>{t("adding.audioFormat.convert.warnings.blocked")}</li>
                    <li>{t("adding.audioFormat.convert.warnings.quality")}</li>
                  </ul>
                </>
              )}

              {isRunning && (
                <>
                  <p>{t("adding.audioFormat.convert.running", { format: label })}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate">
                      {progress?.title
                        ? t("adding.audioFormat.convert.current", {
                            title: progress.title,
                            artist: progress.artist,
                          })
                        : t("adding.audioFormat.convert.starting")}
                    </span>
                    <span className="shrink-0 font-medium text-foreground tabular-nums">
                      {progress ? `${progress.done} / ${progress.total}` : ""}
                    </span>
                  </p>
                </>
              )}

              {error && <p className="text-danger">{error}</p>}

              {report && !error && (
                <>
                  <p>{t("adding.audioFormat.convert.recap", { count: report.converted, format: label })}</p>
                  {report.skipped > 0 && (
                    <p className="mt-1">{t("adding.audioFormat.convert.skipped", { count: report.skipped })}</p>
                  )}
                  {report.failed > 0 && (
                    <p className="mt-1 text-danger">
                      {t("adding.audioFormat.convert.failed", { count: report.failed })}
                    </p>
                  )}
                </>
              )}
            </AlertDialog.Body>

            <AlertDialog.Footer>
              {!done && (
                <Button variant="secondary" onPress={onClose} isDisabled={isRunning}>
                  {t("library.danger.cancel")}
                </Button>
              )}
              {!done && (
                <Button variant="primary" onPress={onConfirm} isDisabled={isRunning}>
                  {isRunning && <Loader2 className="size-4 animate-spin" />}
                  {t("adding.audioFormat.convert.confirm")}
                </Button>
              )}
              {done && (
                <Button variant="primary" onPress={onClose}>
                  {t("adding.audioFormat.convert.close")}
                </Button>
              )}
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
