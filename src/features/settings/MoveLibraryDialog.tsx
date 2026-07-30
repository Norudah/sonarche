import { FolderInput } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";

import { MOVE_PROGRESS_EVENT, type MoveCheck, type MoveProgress } from "@/features/settings/api";
import { formatBytes } from "@/features/settings/libraryLocation";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** One fact about the move, on its own line. Four short rows read faster than
 * a paragraph that hides the number someone is actually looking for. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/**
 * The confirmation for a move, and the progress bar once it starts.
 *
 * One dialog for both halves on purpose: the moment the user says yes, the
 * thing they are watching should stay where their eyes already are. Swapping to
 * a toast or a separate overlay would move the answer away from the question.
 */
export function MoveLibraryDialog({
  check,
  isMoving,
  onClose,
  onConfirm,
}: {
  /** `null` closes it — the dialog exists only once a folder has been picked. */
  check: MoveCheck | null;
  isMoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage ?? "fr";
  const [progress, setProgress] = useState<MoveProgress | null>(null);

  // The backend is an external system and this is the subscription to it. Only
  // live while a move is running, so a settings screen sitting open is not
  // holding a listener for an event that cannot fire.
  useEffect(() => {
    if (!isMoving) return;
    const unlisten = listen<MoveProgress>(MOVE_PROGRESS_EVENT, (event) => setProgress(event.payload));
    // Clearing belongs in the cleanup, not at the top of the body: the counter
    // is only meaningful while a move runs, and a second move must not open on
    // the first one's last number.
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
      title={t(refusal ? "library.move.refusedTitle" : "library.move.title")}
      cancelLabel={t(refusal ? "library.move.close" : "library.move.cancel")}
      confirmLabel={t("library.move.confirm")}
      onConfirm={onConfirm}
      isPending={isMoving || refusal != null}
    >
      {refusal ? (
        <p>{t(`library.move.refusal.${refusal}`)}</p>
      ) : (
        <>
          <p>{t("library.move.body")}</p>

          <div className="mt-3 divide-y divide-separator border-y border-separator text-[0.8125rem]">
            <Fact label={t("library.move.factDestination")} value={check?.target ?? ""} />
            <Fact
              label={t("library.move.factContents")}
              value={t("library.move.contents", {
                count: check?.fileCount ?? 0,
                size: formatBytes(check?.sizeBytes ?? 0, locale),
              })}
            />
            <Fact
              label={t("library.move.factHow")}
              value={t(check?.sameVolume ? "library.move.sameVolume" : "library.move.otherVolume")}
            />
          </div>

          <p className="mt-3">{t("library.move.consequences")}</p>

          {isMoving && (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-default">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[0.75rem] tabular-nums text-muted">
                {/* A same-volume move is a rename: it is over before the bar
                    can draw, so there is nothing to count. */}
                {progress
                  ? t("library.move.progress", { copied: progress.copied, total: progress.total })
                  : t("library.move.starting")}
              </p>
            </div>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}
