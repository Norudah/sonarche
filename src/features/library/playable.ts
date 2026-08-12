import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";

import type { LibraryTrack } from "@/features/library/api";

/**
 * Which tracks the engine will refuse to play.
 *
 * The import takes them in on purpose — an unplayable file still has tags, an
 * album still wants its track 7 present, and dropping it would lose data the
 * user has. But until now nothing said so afterwards: the file sat in the list
 * looking exactly like its neighbours, and the news arrived as an error the one
 * time somebody pressed play on it. The scan promises "they are imported all
 * the same"; this is the other half of that promise being kept.
 *
 * The list comes from Rust rather than being spelled out here, because it is
 * the compiled decoder's list and nothing else — a copy in TypeScript would
 * drift the first time a rodio feature changes.
 */
export const playableKey = ["playable-extensions"] as const;

export function usePlayableExtensions() {
  return useQuery({
    queryKey: playableKey,
    queryFn: () => invoke<string[]>("playable_extensions"),
    // Fixed for the life of the build: it is a compile-time constant.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Lowercased extension of a path, undotted; empty when it carries none. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * A predicate over the loaded list, or one that never fires while it loads.
 *
 * Never fires rather than fires-for-everything: a badge that flashes onto every
 * row for one frame and then vanishes is worse than a badge that arrives late.
 */
export function unplayableTest(extensions: string[] | undefined): (track: LibraryTrack) => boolean {
  if (!extensions || extensions.length === 0) return () => false;
  const known = new Set(extensions);
  return (track) => {
    const ext = extensionOf(track.path);
    return ext !== "" && !known.has(ext);
  };
}
