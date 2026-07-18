import { AlertDialog, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteTracks } from "@/features/library/hooks";

export interface AlbumDeletion {
  title: string;
  /** Library items the album produced; the dialog deletes exactly these. */
  trackIds: number[];
}

export function DeleteAlbumDialog({
  album,
  onClose,
}: {
  album: AlbumDeletion | null;
  onClose: () => void;
}) {
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
    <AlertDialog
      isOpen={album != null}
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
              <AlertDialog.Heading>{t("deleteAlbum.title")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                {t("deleteAlbum.body", {
                  title: shown?.title || t("unknownTitle"),
                  count: shown?.trackIds.length ?? 0,
                })}
              </p>
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
