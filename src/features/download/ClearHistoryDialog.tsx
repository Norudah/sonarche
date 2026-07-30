import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearJobHistory } from "@/features/download/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface ClearHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Terminal (done/failed) downloads the sweep will take. */
  downloads: number;
  /** Archived imports the sweep will take — named explicitly in the body,
   * because clearing them destroys the only record of how a library's tags
   * arrived and a generic total would hide that. */
  imports: number;
  /** The shell's chance to drop the imports cache; the mutation itself only
   * knows about jobs (features do not import each other). */
  onCleared?: () => void;
}

export function ClearHistoryDialog({ isOpen, onClose, downloads, imports, onCleared }: ClearHistoryDialogProps) {
  const { t } = useTranslation("download");
  const clear = useClearJobHistory();

  const confirm = () => {
    clear.mutate(undefined, {
      onSuccess: () => {
        onCleared?.();
        onClose();
      },
    });
  };

  const downloadsFragment = t("queue.clearHistoryDownloads", { count: downloads });
  const importsFragment = t("queue.clearHistoryImports", { count: imports });
  const scope =
    downloads > 0 && imports > 0
      ? t("queue.clearHistoryScopeBoth", { downloads: downloadsFragment, imports: importsFragment })
      : imports > 0
        ? importsFragment
        : downloadsFragment;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      status="danger"
      icon={Trash2}
      title={t("queue.clearHistoryTitle")}
      cancelLabel={t("queue.clearHistoryCancel")}
      confirmLabel={t("queue.clearHistoryConfirm")}
      onConfirm={confirm}
      isPending={clear.isPending}
    >
      <p>{t("queue.clearHistoryBody", { scope, count: downloads + imports })}</p>
      {clear.isError && <p className="mt-2 text-danger">{t("queue.clearHistoryFailed")}</p>}
    </ConfirmDialog>
  );
}
