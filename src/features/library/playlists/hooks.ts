import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CoverCrop } from "@/features/library/api";
import {
  addPlaylistTracks,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  movePlaylistTrack,
  removePlaylistCover,
  removePlaylistTracks,
  renamePlaylist,
  setPlaylistCover,
  setPlaylistMarker,
  type Playlist,
} from "@/features/library/playlists/api";

export const playlistsKey = ["playlists"] as const;

/** Every playlist, once. Same `staleTime: Infinity` reasoning as the library:
 * only our own mutations move this data, and each one invalidates the key. */
export function usePlaylists() {
  return useQuery({
    queryKey: playlistsKey,
    queryFn: listPlaylists,
    staleTime: Infinity,
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

export function useRenamePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renamePlaylist(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

/** Optimistic like remove/move, and for the same reflex: the favorites heart
 * must fill on the click, not after the round-trip. The rewrite mirrors the
 * backend's dedup so a repeated id cannot land twice even transiently. */
export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIds }: { id: number; itemIds: number[] }) => addPlaylistTracks(id, itemIds),
    onMutate: ({ id, itemIds }) => {
      queryClient.setQueryData<Playlist[]>(playlistsKey, (playlists) =>
        playlists?.map((playlist) => {
          if (playlist.id !== id) return playlist;
          const present = new Set(playlist.itemIds);
          const fresh = itemIds.filter((itemId) => !present.has(itemId) && Boolean(present.add(itemId)));
          return fresh.length ? { ...playlist, itemIds: [...playlist.itemIds, ...fresh] } : playlist;
        }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

/** Rewrites the cached playlist before the round-trip: a removed row must
 * leave the screen on the click, not after refetch — same reflex as a reorder. */
export function useRemoveFromPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, positions }: { id: number; positions: number[] }) => removePlaylistTracks(id, positions),
    onMutate: ({ id, positions }) => {
      const doomed = new Set(positions);
      queryClient.setQueryData<Playlist[]>(playlistsKey, (playlists) =>
        playlists?.map((playlist) =>
          playlist.id === id
            ? { ...playlist, itemIds: playlist.itemIds.filter((_, position) => !doomed.has(position)) }
            : playlist,
        ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

export function useSetPlaylistCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sourcePath, crop }: { id: number; sourcePath: string; crop: CoverCrop | null }) =>
      setPlaylistCover(id, sourcePath, crop),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

/** Optimistic: the picker's whole point is watching the sidebar row change, so
 * the cache has to move on the click rather than after the round-trip. */
export function useSetPlaylistMarker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, marker }: { id: number; marker: string }) => setPlaylistMarker(id, marker),
    onMutate: ({ id, marker }) => {
      queryClient.setQueryData<Playlist[]>(playlistsKey, (playlists) =>
        playlists?.map((playlist) => (playlist.id === id ? { ...playlist, marker: marker || null } : playlist)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

export function useRemovePlaylistCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removePlaylistCover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}

/**
 * The favorites list as a fast membership question: is this id in it, and one
 * call to flip that. Built on the ordinary playlist mutations, so the heart,
 * the picker and the detail page can never disagree about what "favorite"
 * means — it is nothing more than membership in the seeded list.
 */
export function useFavorites() {
  const playlists = usePlaylists();
  const add = useAddToPlaylist();
  const remove = useRemoveFromPlaylist();

  const favorites = playlists.data?.find((playlist) => playlist.kind === "favorites") ?? null;
  const ids = new Set(favorites?.itemIds ?? []);

  const toggle = (itemId: number) => {
    if (!favorites) return;
    const position = favorites.itemIds.indexOf(itemId);
    if (position >= 0) {
      remove.mutate({ id: favorites.id, positions: [position] });
    } else {
      add.mutate({ id: favorites.id, itemIds: [itemId] });
    }
  };

  return { favorites, ids, toggle };
}

/** Optimistic for the same reason: the drop must land where the row was
 * released, and a flash back to the old order while the write round-trips
 * would read as the drag failing. */
export function useMovePlaylistTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, from, to }: { id: number; from: number; to: number }) => movePlaylistTrack(id, from, to),
    onMutate: ({ id, from, to }) => {
      queryClient.setQueryData<Playlist[]>(playlistsKey, (playlists) =>
        playlists?.map((playlist) => {
          if (playlist.id !== id) return playlist;
          const itemIds = [...playlist.itemIds];
          const [moved] = itemIds.splice(from, 1);
          if (moved == null) return playlist;
          itemIds.splice(to, 0, moved);
          return { ...playlist, itemIds };
        }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: playlistsKey });
    },
  });
}
