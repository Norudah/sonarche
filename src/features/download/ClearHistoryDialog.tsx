import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearJobHistory } from "@/features/download/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface ClearHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Finished downloads to be cleared. */
  downloads: number;
  /** Named explicitly: clearing them loses the record of how tags arrived. */
  imports: number;
  /** Lets the shell drop the imports cache. */
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
