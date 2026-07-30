import { AlertDialog, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearJobHistory } from "@/features/download/hooks";

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
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Icon status="danger">
              <Trash2 className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t("queue.clearHistoryTitle")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("queue.clearHistoryBody", { scope, count: downloads + imports })}</p>
              {clear.isError && <p className="mt-2 text-sm text-danger">{t("queue.clearHistoryFailed")}</p>}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" onPress={onClose} isDisabled={clear.isPending}>
                {t("queue.clearHistoryCancel")}
              </Button>
              <Button variant="danger" onPress={confirm} isDisabled={clear.isPending}>
                {t("queue.clearHistoryConfirm")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
