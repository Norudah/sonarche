import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useDeleteTrack } from "@/features/library/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

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
    <ConfirmDialog
      isOpen={track != null}
      onClose={onClose}
      status="danger"
      icon={Trash2}
      title={t("delete.title")}
      cancelLabel={t("delete.cancel")}
      confirmLabel={t("delete.confirm")}
      onConfirm={confirm}
      isPending={remove.isPending}
    >
      <p>{t("delete.body", { title: shown?.title || t("unknownTitle") })}</p>
      {remove.isError && <p className="mt-2 text-danger">{t("delete.failed")}</p>}
    </ConfirmDialog>
  );
}
