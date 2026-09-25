import { toast } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteTracks, useDownloadTargetAlbums } from "@/features/library/hooks";
import { TOAST_EXPLAINED } from "@/shared/toast/durations";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export interface AlbumDeletion {
  title: string;
  /** The dialog deletes exactly these items. */
  trackIds: number[];
}

/** Refuses (with a toast) to delete an album a running download will file
 * into: the later move would fail silently. Returns whether to proceed. */
export function useAlbumDeleteGuard(): (albumIds: number[]) => boolean {
  const { t } = useTranslation("library");
  // Stable while the set is, for memoised download cards.
  const locked = useDownloadTargetAlbums().data;

  return useCallback(
    (albumIds) => {
      if (!locked || !albumIds.some((id) => locked.has(id))) return true;
      toast.warning(t("deleteAlbum.lockedTitle"), {
        description: t("deleteAlbum.lockedBody"),
        timeout: TOAST_EXPLAINED,
      });
      return false;
    },
    [locked, t],
  );
}

export function DeleteAlbumDialog({ album, onClose }: { album: AlbumDeletion | null; onClose: () => void }) {
  const { t } = useTranslation("library");
  const remove = useDeleteTracks();

  // Keeps the title during the closing animation.
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
