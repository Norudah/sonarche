import { AlertDialog, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useDeleteTrack } from "@/features/library/hooks";

export function DeleteTrackDialog({
  track,
  onClose,
  onDeleted,
}: {
  track: LibraryTrack | null;
  onClose: () => void;
  /** Fired only on a confirmed deletion — lets callers dismiss anything still
   * showing the now-gone track (the metadata drawer). */
  onDeleted?: () => void;
}) {
  const { t } = useTranslation("library");
  const remove = useDeleteTrack();

  // Keep the last track around so its title doesn't flicker during the closing animation.
  const lastRef = useRef<LibraryTrack | null>(null);
  if (track) lastRef.current = track;
  const shown = track ?? lastRef.current;

  const confirm = () => {
    if (!track) return;
    remove.mutate(track.id, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
    });
  };

  return (
    <AlertDialog
      isOpen={track != null}
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
              <AlertDialog.Heading>{t("delete.title")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("delete.body", { title: shown?.title || t("unknownTitle") })}</p>
              {remove.isError && <p className="mt-2 text-sm text-danger">{t("delete.failed")}</p>}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" onPress={onClose} isDisabled={remove.isPending}>
                {t("delete.cancel")}
              </Button>
              <Button variant="danger" onPress={confirm} isDisabled={remove.isPending}>
                {t("delete.confirm")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
