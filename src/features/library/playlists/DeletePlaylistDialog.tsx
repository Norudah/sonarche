import { ListX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDeletePlaylist } from "@/features/library/playlists/hooks";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export interface PlaylistDeletion {
  id: number;
  name: string;
  trackCount: number;
}

interface DeletePlaylistDialogProps {
  playlist: PlaylistDeletion | null;
  onClose: () => void;
  /** After the row is gone — the detail page navigates back to the shelf. */
  onDeleted?: () => void;
}

/** Deleting a playlist deletes a *list*: the dialog says so, because the word
 * "supprimer" next to track counts reads like files are about to go. */
export function DeletePlaylistDialog({ playlist, onClose, onDeleted }: DeletePlaylistDialogProps) {
  const { t } = useTranslation("library");
  const deletion = useDeletePlaylist();

  return (
    <ConfirmDialog
      isOpen={playlist != null}
      onClose={onClose}
      status="danger"
      icon={ListX}
      title={t("playlists.delete.title", { name: playlist?.name ?? "" })}
      cancelLabel={t("playlists.cancel")}
      confirmLabel={t("playlists.delete.confirm")}
      isPending={deletion.isPending}
      onConfirm={() => {
        if (!playlist) return;
        deletion.mutate(playlist.id, {
          onSuccess: () => {
            onClose();
            onDeleted?.();
          },
        });
      }}
    >
      {t("playlists.delete.body", { count: playlist?.trackCount ?? 0 })}
    </ConfirmDialog>
  );
}
