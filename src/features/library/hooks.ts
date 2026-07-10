import { useQuery } from "@tanstack/react-query";

import { listLibrary } from "@/features/library/api";

export const libraryKey = ["library"] as const;

export function useLibrary() {
  return useQuery({
    queryKey: libraryKey,
    queryFn: listLibrary,
  });
}
