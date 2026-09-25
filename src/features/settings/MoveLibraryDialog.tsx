import { FolderInput } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";

import { MOVE_PROGRESS_EVENT, type MoveCheck, type MoveProgress } from "@/features/settings/api";
import { formatBytes } from "@/features/settings/libraryLocation";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Confirmation and progress in one dialog, so the answer stays where the question was. */
export function MoveLibraryDialog({
  check,
  isMoving,
  onClose,
  onConfirm,
}: {
  /** `null` closes it. */
  check: MoveCheck | null;
  isMoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage ?? "fr";
  const [progress, setProgress] = useState<MoveProgress | null>(null);

  // Subscribed only while a move runs.
  useEffect(() => {
    if (!isMoving) return;
    const unlisten = listen<MoveProgress>(MOVE_PROGRESS_EVENT, (event) => setProgress(event.payload));
    // Reset in cleanup so the next move starts at zero.
    return () => {
      void unlisten.then((off) => off());
      setProgress(null);
    };
  }, [isMoving]);

  const refusal = check?.refusal ?? null;
  const percent = progress && progress.total > 0 ? Math.round((progress.copied / progress.total) * 100) : 0;

  return (
    <ConfirmDialog
      isOpen={check != null}
      onClose={onClose}
      status="warning"
      icon={FolderInput}
      title={t(refusal ? "files.move.refusedTitle" : "files.move.title")}
      cancelLabel={t(refusal ? "files.move.close" : "files.move.cancel")}
      confirmLabel={t("files.move.confirm")}
      onConfirm={onConfirm}
      isPending={isMoving || refusal != null}
    >
      {refusal ? (
        <p>{t(`files.move.refusal.${refusal}`)}</p>
      ) : (
        <>
          <p>{t("files.move.body")}</p>

          <div className="mt-3 divide-y divide-separator border-y border-separator text-[0.8125rem]">
            <Fact label={t("files.move.factDestination")} value={check?.target ?? ""} />
            <Fact
              label={t("files.move.factContents")}
              value={t("files.move.contents", {
                count: check?.fileCount ?? 0,
                size: formatBytes(check?.sizeBytes ?? 0, locale),
              })}
            />
            <Fact
              label={t("files.move.factHow")}
              value={t(check?.sameVolume ? "files.move.sameVolume" : "files.move.otherVolume")}
            />
          </div>

          <p className="mt-3">{t("files.move.consequences")}</p>

          {isMoving && (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-default">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[0.75rem] tabular-nums text-muted">
                {/* A same-volume move is a rename: nothing to count. */}
                {progress
                  ? t("files.move.progress", { copied: progress.copied, total: progress.total })
                  : t("files.move.starting")}
              </p>
            </div>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}
