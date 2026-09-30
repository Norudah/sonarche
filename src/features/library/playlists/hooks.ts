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

/** `staleTime: Infinity`: only our own mutations change it, and they invalidate it. */
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

/** Optimistic, mirroring the backend's dedup. */
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

/** Optimistic. */
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

/** Optimistic, so the sidebar updates on click. */
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

/** Favorites as a membership test plus a toggle, over the ordinary playlist mutations. */
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

/** Optimistic, so the row lands where it was dropped. */
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
