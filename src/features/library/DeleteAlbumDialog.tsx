import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteTracks } from "@/features/library/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export interface AlbumDeletion {
  title: string;
  /** Library items the album produced; the dialog deletes exactly these. */
  trackIds: number[];
}

export function DeleteAlbumDialog({ album, onClose }: { album: AlbumDeletion | null; onClose: () => void }) {
  const { t } = useTranslation("library");
  const remove = useDeleteTracks();

  // Keep the last album around so its title doesn't flicker during the closing animation.
  const lastRef = useRef<AlbumDeletion | null>(null);
  if (album) lastRef.current = album;
  const shown = album ?? lastRef.current;

  const confirm = () => {
    if (!album) return;
    remove.mutate(album.trackIds, { onSuccess: onClose });
  };

  return (
    <ConfirmDialog
      isOpen={album != null}
      onClose={onClose}
      status="danger"
      icon={Trash2}
      title={t("deleteAlbum.title")}
      cancelLabel={t("delete.cancel")}
      confirmLabel={t("delete.confirm")}
      onConfirm={confirm}
      isPending={remove.isPending}
    >
      <p>
        {t("deleteAlbum.body", {
          title: shown?.title || t("unknownTitle"),
          count: shown?.trackIds.length ?? 0,
        })}
      </p>
      {remove.isError && <p className="mt-2 text-danger">{t("delete.failed")}</p>}
    </ConfirmDialog>
  );
}
