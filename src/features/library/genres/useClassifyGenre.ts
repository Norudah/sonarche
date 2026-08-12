import { toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { listGenreOverrides, setGenreFamily } from "@/features/library/api";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { libraryKey } from "@/features/library/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE, TOAST_UNDO } from "@/shared/toast/durations";

export const genreOverridesKey = ["genre-overrides"] as const;

/** The user's placements as a lookup — keys lowercased, the way the sidecar
 * stores them. Same `staleTime: Infinity` reasoning as the library: only our
 * own mutation moves this, and it invalidates the key. */
export function useGenreOverrides() {
  return useQuery({
    queryKey: genreOverridesKey,
    queryFn: listGenreOverrides,
    staleTime: Infinity,
    select: (overrides) => new Map(overrides.map((override) => [override.genre.toLowerCase(), override.family])),
  });
}

/**
 * The placement, told and reversible: files the genre and hangs the way back
 * on the toast. Undo is the same verb pointed at the previous value —
 * restoring the earlier placement if there was one, returning to the base
 * tree if there was none.
 *
 * No navigation here: the genre page follows its subject on its own when the
 * refetch lands (see the rename-move guard in `GenreDetailView`), which is
 * what makes the redirect race-free — it fires from the new data, not before.
 */
export function useClassifyGenre() {
  const { t } = useTranslation("library");
  const labelOf = useFamilyLabel();
  const queryClient = useQueryClient();
  // One undo per placement, however long the toast lingers.
  const undoing = useRef(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: libraryKey });
    queryClient.invalidateQueries({ queryKey: genreOverridesKey });
  };

  const undo = async (genre: string, previous: string | null, toastId: string) => {
    if (undoing.current) return;
    undoing.current = true;
    toast.close(toastId);
    try {
      await setGenreFamily(genre, previous);
      toast(t("genres.classifyUndoneToast"), { timeout: TOAST_GLANCE });
    } catch (error) {
      toast(t("genres.classifyFailedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
    } finally {
      invalidate();
    }
  };

  const mutation = useMutation({
    mutationFn: ({ genre, family }: { genre: string; family: string | null }) => setGenreFamily(genre, family),
    // Settled, not success: a failed call can still have written the overrides
    // file before the derived-tree write tripped, and a refetch is cheap.
    onSettled: invalidate,
  });

  /** File `genre` under `family` (null = back to the base tree).
   * `previousOverride` is the placement this replaces, if any — what undo
   * points the same verb back at. */
  const run = (genre: string, family: string | null, previousOverride: string | null) => {
    undoing.current = false;
    mutation.mutate(
      { genre, family },
      {
        onSuccess: (result) => {
          const toastId = toast(
            result.family == null
              ? t("genres.classifyResetToast", { genre })
              : t("genres.classifyDoneToast", { genre, family: labelOf(result.family) }),
            {
              timeout: TOAST_UNDO,
              // Soft rather than filled — same register as the move toast: the
              // report already worked, the way back should not shout over it.
              actionProps: {
                variant: "secondary",
                children: t("genres.classifyUndo"),
                onPress: () => void undo(genre, previousOverride, toastId),
              },
            },
          );
        },
        onError: (error) => {
          toast(t("genres.classifyFailedToast"), { description: String(error), timeout: TOAST_EXPLAINED });
        },
      },
    );
  };

  return { run, isPending: mutation.isPending };
}
