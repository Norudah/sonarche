/**
 * Pending checks per track, using the Metadata page's own predicates (enabled
 * and not accepted), so both always agree. Counted per door, so a "genre off
 * tree" track isn't described as "genre missing".
 */

import { useMemo } from "react";

import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { type CheckKey, enabledLines, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { buildTriageQueue, type DoorKey } from "@/features/library/triage/queue";

/** `queue.ts`'s track subject prefix. */
const TRACK_PREFIX = "t:";

/** Doors naming each pending track, most serious first; absent means nothing pending. */
type AlbumAttention = ReadonlyMap<number, DoorKey[]>;

/** Scoped to the given list: "duplicates" means within this list. */
export function trackAttention(tracks: LibraryTrack[], albums: Album[], disabled: CheckKey[]): AlbumAttention {
  const lines = enabledLines(buildTriageQueue(tracks, albums), disabled);

  const reasons = new Map<number, DoorKey[]>();

  for (const line of lines) {
    for (const door of line.doors) {
      const ids = new Set<number>();
      for (const subject of door.subjects) {
        if (subject.startsWith(TRACK_PREFIX)) ids.add(Number(subject.slice(TRACK_PREFIX.length)));
      }
      if (ids.size === 0) continue;

      for (const id of ids) reasons.set(id, [...(reasons.get(id) ?? []), door.key]);
    }
  }

  return reasons;
}

/** With the album in scope for album-level doors. */
export function albumAttention(album: Album, disabled: CheckKey[]): AlbumAttention {
  return trackAttention(album.tracks, [album], disabled);
}

/** Live: re-renders when a check is toggled. */
export function useAlbumAttention(album: Album): AlbumAttention {
  const disabled = useDisabledChecks();
  return useMemo(() => albumAttention(album, disabled), [album, disabled]);
}

/** For a free-standing list (the inspection table). No albums in scope:
 * album-level doors never reach a row. */
export function useTrackAttention(tracks: LibraryTrack[]): AlbumAttention {
  const disabled = useDisabledChecks();
  return useMemo(() => trackAttention(tracks, [], disabled), [tracks, disabled]);
}
