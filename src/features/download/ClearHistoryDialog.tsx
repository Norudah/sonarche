import { AlertDialog, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearJobHistory } from "@/features/download/hooks";

export function ClearHistoryDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation("download");
  const clear = useClearJobHistory();

  const confirm = () => {
    clear.mutate(undefined, { onSuccess: onClose });
  };

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
              <p>{t("queue.clearHistoryBody")}</p>
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
