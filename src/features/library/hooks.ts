import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  deleteTrack,
  listLibrary,
  recomputeGenres,
  reenrichTrack,
  setAlbumCover,
  updateTracks,
  type CoverCrop,
} from "@/features/library/api";

export const libraryKey = ["library"] as const;

/**
 * The whole library, once.
 *
 * `staleTime: Infinity` because nothing changes this data behind our back: the
 * beets DB moves only through our own commands, and every one of them —
 * edit, delete, re-enrich, recompute, a finished download, the dev wipe —
 * invalidates this key, which refetches an active query regardless of staleness.
 * The default (stale immediately) meant every route that mounts this hook
 * refetched the entire listing on arrival: a full Rust -> Python -> SQLite
 * round-trip, JSON for every track in the library, to redraw a page whose data
 * had not moved. Navigating between two shelves paid for the library twice.
 *
 * The cost of being wrong is a listing that lags an out-of-band edit until the
 * next launch — which `refetchOnWindowFocus: false` already meant we would not
 * have caught anyway.
 */
export function useLibrary() {
  return useQuery({
    queryKey: libraryKey,
    queryFn: listLibrary,
    staleTime: Infinity,
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
    // Deliberately not awaited: the caller's own `onSuccess` has to run in this
    // same tick, before the refetch lands. Renaming a record depends on it — the
    // album route is built from (artist, title), so the panel must move the URL
    // to the new name while the old data is still on screen. `AlbumDetailView`
    // holds the page steady across the gap.
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
  // Twenty-nine sequential network round-trips is a wait, not a blink: a
  // spinner alone leaves the user unable to decide whether to sit through it.
  const [progress, setProgress] = useState<{ done: number; matched: number; total: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (ids: number[]) => {
      let matched = 0;
      setProgress({ done: 0, matched: 0, total: ids.length });
      for (const [index, id] of ids.entries()) {
        const result = await reenrichTrack(id);
        if (result.matched) matched += 1;
        setProgress({ done: index + 1, matched, total: ids.length });
      }
      return { matched, total: ids.length };
    },
    onSettled: () => {
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });

  return { ...mutation, progress };
}

/** Replace the cover of every beets album behind one shelf album. Usually one
 * id; a group spanning two beets rows (a merge beets has not consolidated yet)
 * gets the picture on both, so no folder keeps the old art. Sequential for the
 * same single-writer reason as the other batch mutations. */
export function useSetAlbumCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      albumIds,
      sourcePath,
      crop,
    }: {
      albumIds: number[];
      sourcePath: string;
      crop: CoverCrop | null;
    }) => {
      for (const albumId of albumIds) await setAlbumCover(albumId, sourcePath, crop);
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
