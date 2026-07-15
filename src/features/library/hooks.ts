import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteTrack, listLibrary, reenrichTrack } from "@/features/library/api";

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

export function useReenrichTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reenrichTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKey });
    },
  });
}
