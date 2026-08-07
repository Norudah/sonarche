import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  deleteTrack,
  listArtistImages,
  listLibrary,
  recomputeGenres,
  reenrichTrack,
  removeArtistImage,
  setAlbumCover,
  setArtistImage,
  updateTracks,
  type CoverCrop,
  type CoverSource,
} from "@/features/library/api";
import { playlistsKey } from "@/features/library/playlists/hooks";

export const libraryKey = ["library"] as const;
export const artistImagesKey = ["artist-images"] as const;

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
      // The backend pruned the track out of every playlist alongside.
      queryClient.invalidateQueries({ queryKey: playlistsKey });
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
      queryClient.invalidateQueries({ queryKey: playlistsKey });
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
      // An albumartist rename moves the artist's image with the name; the
      // name -> image map has to follow.
      queryClient.invalidateQueries({ queryKey: artistImagesKey });
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
 * rather than eighteen times mid-flight.
 *
 * The sequence is also what makes `cancel` honest: the flag is read between
 * tracks, so stopping never abandons a half-written file — the track in flight
 * finishes, the rest are simply not started. */
export function useReenrichAlbum() {
  const queryClient = useQueryClient();
  // Twenty-nine sequential network round-trips is a wait, not a blink: a
  // spinner alone leaves the user unable to decide whether to sit through it.
  const [progress, setProgress] = useState<{ done: number; matched: number; total: number } | null>(null);
  // The ref is what the loop reads (state would be a stale closure there); the
  // state is what the Stop button reflects while the current track drains.
  const cancelRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const mutation = useMutation({
    mutationFn: async (ids: number[]) => {
      cancelRef.current = false;
      let matched = 0;
      let done = 0;
      setProgress({ done: 0, matched: 0, total: ids.length });
      for (const id of ids) {
        if (cancelRef.current) break;
        const result = await reenrichTrack(id);
        if (result.matched) matched += 1;
        done += 1;
        setProgress({ done, matched, total: ids.length });
      }
      return { matched, done, total: ids.length, cancelled: cancelRef.current };
    },
    onSettled: () => {
      setProgress(null);
      setIsCancelling(false);
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });

  const cancel = () => {
    cancelRef.current = true;
    setIsCancelling(true);
  };

  return { ...mutation, progress, cancel, isCancelling };
}

/** Replace the cover of every beets album behind one shelf album. Usually one
 * id; a group spanning two beets rows (a merge beets has not consolidated yet)
 * gets the picture on both, so no folder keeps the old art. Sequential for the
 * same single-writer reason as the other batch mutations. */
export function useSetAlbumCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ albumIds, source }: { albumIds: number[]; source: CoverSource }) => {
      for (const albumId of albumIds) await setAlbumCover(albumId, source);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

/** The artist -> image URL map, once. Same `staleTime: Infinity` reasoning as
 * the library: only our own mutations move it, and each invalidates the key. */
export function useArtistImages() {
  return useQuery({
    queryKey: artistImagesKey,
    queryFn: async () => {
      const images = await listArtistImages();
      return new Map(images.map((image) => [image.name, image.url]));
    },
    staleTime: Infinity,
  });
}

export function useSetArtistImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, sourcePath, crop }: { name: string; sourcePath: string; crop: CoverCrop | null }) =>
      setArtistImage(name, sourcePath, crop),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistImagesKey });
    },
  });
}

export function useRemoveArtistImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeArtistImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artistImagesKey });
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
