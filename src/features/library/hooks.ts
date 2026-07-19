import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteTrack, listLibrary, recomputeGenres, reenrichTrack } from "@/features/library/api";

export const libraryKey = ["library"] as const;

export function useLibrary() {
  return useQuery({
    queryKey: libraryKey,
    queryFn: listLibrary,
  });
}

export function useDeleteTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

/** Delete a whole album's items as one unit. Sequential rather than parallel:
 * each delete_track call has beets rewrite the same library file, and the
 * cache is invalidated once at the end instead of N times mid-flight. */
export function useDeleteTracks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await deleteTrack(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

export function useReenrichTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reenrichTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

export function useRecomputeGenres() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recomputeGenres,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}
