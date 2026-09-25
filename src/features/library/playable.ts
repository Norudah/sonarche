import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";

import type { LibraryTrack } from "@/features/library/api";

/** The engine's playable extensions (from Rust, so there's no copy to drift),
 * used to flag imported tracks that won't play. */
const playableKey = ["playable-extensions"] as const;

export function usePlayableExtensions() {
  return useQuery({
    queryKey: playableKey,
    queryFn: () => invoke<string[]>("playable_extensions"),
    // A compile-time constant.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Never matches while loading, so badges don't flash on every row. */
export function unplayableTest(extensions: string[] | undefined): (track: LibraryTrack) => boolean {
  if (!extensions || extensions.length === 0) return () => false;
  const known = new Set(extensions);
  return (track) => {
    const ext = extensionOf(track.path);
    return ext !== "" && !known.has(ext);
  };
}
