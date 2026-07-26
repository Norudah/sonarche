import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteTrack, listLibrary, recomputeGenres, reenrichTrack, updateTracks } from "@/features/library/api";

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

/** Persist metadata edits for one or many tracks in a single call, then
 * refresh the library once. The batch is the perf-sensitive shape: an album's
 * worth of common-field edits ships as one round-trip, not one per track. */
export function useUpdateTracks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTracks,
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

/** Re-run the acoustic match over a whole album, and report how many tracks
 * came back matched. Sequential for the same reason as `useDeleteTracks`: each
 * call has beets rewrite the same library file, so firing eighteen at once only
 * makes them queue on that file — with the cache invalidated once at the end
 * rather than eighteen times mid-flight. */
export function useReenrichAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      let matched = 0;
      for (const id of ids) {
        const result = await reenrichTrack(id);
        if (result.matched) matched += 1;
      }
      return { matched, total: ids.length };
    },
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
