import { toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { groupAlbums } from "@/features/library/albums/albums";
import { buildMoveUndo } from "@/features/library/albums/undoMove";
import { moveTracks, updateTracks, type LibraryTrack, type MoveSpec } from "@/features/library/api";
import { libraryKey, useMoveTracks } from "@/features/library/hooks";

/**
 * The move, told and reversible: performs one request, announces it, and hangs
 * the way back on the toast. Undo is the same verb pointed at the snapshot's
 * records (see `buildMoveUndo`) — no marker on disk, no second machinery.
 */
export function useMoveWithUndo() {
  const { t } = useTranslation("library");
  const queryClient = useQueryClient();
  const move = useMoveTracks();
  // One undo per move, however long the toast lingers or however fast the
  // clicks land.
  const undoing = useRef(false);

  const undo = async (snapshot: LibraryTrack[], toastId: string) => {
    if (undoing.current) return;
    undoing.current = true;
    toast.close(toastId);
    const shelf = groupAlbums(queryClient.getQueryData<LibraryTrack[]>(libraryKey) ?? []);
    const plan = buildMoveUndo(snapshot, shelf);
    if (!plan) return;
    try {
      for (const spec of plan.specs) await moveTracks(spec);
      await updateTracks(plan.restore);
      toast(t("move.undoneToast"));
    } catch (error) {
      toast(t("move.undoFailedToast"), { description: String(error) });
    } finally {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    }
  };

  /** Run `spec`; `snapshot` is the moved tracks as they are *now*, i.e. before
   * the move — everything the way back needs to know. */
  const run = (spec: MoveSpec, snapshot: LibraryTrack[], targetName: string, onSuccess?: () => void) => {
    undoing.current = false;
    move.mutate(spec, {
      onSuccess: ({ moved }) => {
        const undoable = snapshot.every((track) => track.album.trim() !== "");
        const toastId = toast(
          t("move.doneToast", { count: moved, name: targetName }),
          undoable
            ? {
                // Longer than the 4s default: the way back rides this toast,
                // and reading a sentence then deciding takes more than four
                // seconds — after that the move simply stands.
                timeout: 10_000,
                // Soft rather than filled: the toast reports something that
                // already worked, so the loudest object in it should not be
                // the button that takes it back.
                actionProps: {
                  variant: "secondary",
                  children: t("move.undo"),
                  onPress: () => void undo(snapshot, toastId),
                },
              }
            : undefined,
        );
        onSuccess?.();
      },
      onError: (error) => {
        toast(t("move.failedToast"), { description: String(error) });
      },
    });
  };

  return { run, isPending: move.isPending };
}
