import { toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { listGenreOverrides, setGenreFamily } from "@/features/library/api";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";
import { libraryKey } from "@/features/library/hooks";
import { TOAST_EXPLAINED, TOAST_GLANCE, TOAST_UNDO } from "@/shared/toast/durations";

const genreOverridesKey = ["genre-overrides"] as const;

/** Lowercased keys, as the sidecar stores them. `staleTime: Infinity`. */
export function useGenreOverrides() {
  return useQuery({
    queryKey: genreOverridesKey,
    queryFn: listGenreOverrides,
    staleTime: Infinity,
    select: (overrides) => new Map(overrides.map((override) => [override.genre.toLowerCase(), override.family])),
  });
}

/** Files a genre and offers undo on the toast. No navigation: the genre page
 * follows its subject when the refetch lands (see `GenreDetailView`). */
export function useClassifyGenre() {
  const { t } = useTranslation("library");
  const labelOf = useFamilyLabel();
  const queryClient = useQueryClient();
  // One undo per placement.
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
    // Settled: a failed call may still have written the overrides file.
    onSettled: invalidate,
  });

  /** `family` null restores the base tree; `previousOverride` is what undo restores. */
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
              // Soft: the toast reports a success.
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
