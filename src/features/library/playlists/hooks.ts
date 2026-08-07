import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addPlaylistTracks,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  movePlaylistTrack,
  removePlaylistTracks,
  renamePlaylist,
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

export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemIds }: { id: number; itemIds: number[] }) => addPlaylistTracks(id, itemIds),
    onSuccess: () => {
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
