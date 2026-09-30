import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ConvertReport } from "@/features/settings/api";
import type { AudioFormat } from "@/features/settings/audioFormats";
import type { ConvertProgress } from "@/features/settings/hooks";

/**
 * The only blocking modal: each original is deleted as its replacement lands,
 * so playing, editing or moving files mid-pass would race. Warn, work and
 * report in one dialog.
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
  const label = t(`files.audioFormat.formats.${format}.name`);
  const done = report != null || error != null;
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        // Not dismissable while a pass runs.
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
                  ? t("files.audioFormat.convert.doneTitle")
                  : t("files.audioFormat.convert.title", { format: label })}
              </AlertDialog.Heading>
            </AlertDialog.Header>

            <AlertDialog.Body className="text-sm leading-relaxed text-muted">
              {!isRunning && !done && (
                <>
                  <p>{t("files.audioFormat.convert.intro", { format: label })}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>{t("files.audioFormat.convert.warnings.time")}</li>
                    <li>{t("files.audioFormat.convert.warnings.blocked")}</li>
                    <li>{t("files.audioFormat.convert.warnings.quality")}</li>
                  </ul>
                </>
              )}

              {isRunning && (
                <>
                  <p>{t("files.audioFormat.convert.running", { format: label })}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate">
                      {progress?.title
                        ? t("files.audioFormat.convert.current", {
                            title: progress.title,
                            artist: progress.artist,
                          })
                        : t("files.audioFormat.convert.starting")}
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
                  <p>{t("files.audioFormat.convert.recap", { count: report.converted, format: label })}</p>
                  {report.skipped > 0 && (
                    <p className="mt-1">{t("files.audioFormat.convert.skipped", { count: report.skipped })}</p>
                  )}
                  {report.failed > 0 && (
                    <p className="mt-1 text-danger">
                      {t("files.audioFormat.convert.failed", { count: report.failed })}
                    </p>
                  )}
                </>
              )}
            </AlertDialog.Body>

            <AlertDialog.Footer>
              {!done && (
                <Button variant="secondary" onPress={onClose} isDisabled={isRunning}>
                  {t("danger.cancel")}
                </Button>
              )}
              {!done && (
                <Button variant="primary" onPress={onConfirm} isDisabled={isRunning}>
                  {isRunning && <Loader2 className="size-4 animate-spin" />}
                  {t("files.audioFormat.convert.confirm")}
                </Button>
              )}
              {done && (
                <Button variant="primary" onPress={onClose}>
                  {t("files.audioFormat.convert.close")}
                </Button>
              )}
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
