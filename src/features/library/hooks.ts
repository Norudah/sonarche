import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

import {
  deleteTrack,
  listArtistImages,
  listDownloadTargetAlbums,
  listLibrary,
  moveTracks,
  recomputeGenres,
  reenrichTrack,
  removeArtistImage,
  setAlbumCover,
  setAlbumKind,
  setCheckAccepted,
  setArtistImage,
  updateTracks,
  type AcceptedCheck,
  type AlbumKind,
  type CoverCrop,
  type CoverSource,
} from "@/features/library/api";
import { playlistsKey } from "@/features/library/playlists/hooks";

export const libraryKey = ["library"] as const;
export const artistImagesKey = ["artist-images"] as const;
export const downloadTargetsKey = ["download-target-albums"] as const;

/** The whole library. `staleTime: Infinity`: it only changes through our own
 * commands, all of which invalidate this key. */
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
      // The backend also removed it from every playlist.
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

/** Sequential: each call rewrites the same beets file. One invalidation at the end. */
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

/** One round-trip for a batch of edits. */
export function useUpdateTracks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTracks,
    // Not awaited: the caller's onSuccess (e.g. moving the album URL on rename)
    // must run before the refetch lands.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
      // Renames move artist images.
      queryClient.invalidateQueries({ queryKey: artistImagesKey });
    },
  });
}

export function useMoveTracks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moveTracks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

/** Only the listing caches the kind. */
export function useSetAlbumKind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ albumIds, kind }: { albumIds: number[]; kind: AlbumKind }) => setAlbumKind(albumIds, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}

export function useSetCheckAccepted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scope,
      ids,
      check,
      accepted,
    }: {
      scope: "track" | "album";
      ids: number[];
      check: AcceptedCheck;
      accepted: boolean;
    }) => setCheckAccepted(scope, ids, check, accepted),
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

/** Re-matches a whole album sequentially (one beets writer); cancelling
 * finishes the track in flight and skips the rest. Reports matched counts. */
export function useReenrichAlbum() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; matched: number; total: number } | null>(null);
  // The loop reads the ref; the state drives the UI.
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

/** Sets the cover on every beets album row behind one shelf album. Sequential. */
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

/** Artist -> image URL. The cache holds the listing; the map is derived in
 * `select` (`useArtistImagePath` reads the same rows). */
export function useArtistImages() {
  return useQuery({
    queryKey: artistImagesKey,
    queryFn: listArtistImages,
    staleTime: Infinity,
    select: (images) => new Map(images.map((image) => [image.name, image.url])),
  });
}

/** Null when none is stored. */
export function useArtistImagePath(name: string): string | null {
  return (
    useQuery({
      queryKey: artistImagesKey,
      queryFn: listArtistImages,
      staleTime: Infinity,
      select: (images) => images.find((image) => image.name === name)?.path ?? null,
    }).data ?? null
  );
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

/** Albums running downloads file into, refreshed on `jobs:updated`. From the
 * backend, since the library can't import the download feature. */
export function useDownloadTargetAlbums() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: downloadTargetsKey,
    queryFn: async () => new Set(await listDownloadTargetAlbums()),
    staleTime: Infinity,
  });

  useEffect(() => {
    const unlisten = listen("jobs:updated", () => {
      queryClient.invalidateQueries({ queryKey: downloadTargetsKey });
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [queryClient]);

  return query;
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
