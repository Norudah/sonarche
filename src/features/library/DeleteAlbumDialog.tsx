import { toast } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteTracks, useDownloadTargetAlbums } from "@/features/library/hooks";
import { TOAST_EXPLAINED } from "@/shared/toast/durations";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export interface AlbumDeletion {
  title: string;
  /** Library items the album produced; the dialog deletes exactly these. */
  trackIds: number[];
}

/**
 * Says no to deleting a record a download is still filing into.
 *
 * A download bound for an existing album moves its tracks onto that row once
 * the enrich step is done, and the move's only reaction to a missing target is
 * a log line — the job still comes out green while the tracks sit on whatever
 * release the pipeline guessed. So the refusal has to happen before the dialog
 * opens, and it has to say why: a delete that quietly does nothing reads as a
 * broken button.
 *
 * Returns whether the caller may proceed, and raises the toast when it may not.
 */
export function useAlbumDeleteGuard(): (albumIds: number[]) => boolean {
  const { t } = useTranslation("library");
  // Stable across renders while the set is: the download deck re-renders
  // several times a second during an album, and hands this straight to memoed
  // cards.
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
