/**
 * What one record still has pending — the Metadata page's own verdict, scoped
 * to a single album.
 *
 * There used to be a second, private scale: a completeness ratio counting
 * filled cells over `tracks × 7 fields`. It could not agree with the page, and
 * worse, it could not be satisfied — turning the year check off or answering
 * "c'est voulu" emptied the page and left the album's gauge amber forever. A
 * measure with an unreachable zero is a reproach, not information.
 *
 * So there is one scale now. A track is pending if any *enabled, unanswered*
 * check names it, which is the very predicate the page and the explorer doors
 * use. Whatever silences it there silences it here.
 *
 * Counted at door grain rather than line grain: the queue fuses "no genre" and
 * "a genre the tree does not know" into one line, because one editor fixes
 * both — but a caption that says "genre missing" over a record whose every
 * track *has* a genre is simply false, and being told the wrong thing is worse
 * than being told nothing.
 *
 * Album-level doors (artwork, tracklist) are read out deliberately: nothing
 * consumes this per record any more — the album's hero says nothing about
 * metadata at all. A verdict on a whole record belongs where you went to act on
 * it (the edit modals, the Metadata page), not stamped on the page you opened
 * to listen to music.
 */

import { useMemo } from "react";

import type { Album } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import { type CheckKey, enabledLines, useDisabledChecks } from "@/features/library/triage/enabledChecks";
import { buildTriageQueue, type DoorKey } from "@/features/library/triage/queue";

/** How `queue.ts` prefixes a track subject. */
const TRACK_PREFIX = "t:";

/** Why each pending track is named, in queue order (most serious first). A
 * track absent from the map has nothing pending — which is most of them, and
 * why this is a map and not a field on every row. */
export type AlbumAttention = ReadonlyMap<number, DoorKey[]>;

/**
 * The verdict for a set of tracks, by track id.
 *
 * Scoped to whatever list it is handed, which is what makes the duplicates door
 * mean "twice on this record" on an album and "twice in this list" in the
 * inspection table. Both are true; each is the one you can act on from where
 * you are standing.
 */
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

/** The album's own rows, with its record in scope so the album-level doors are
 * computed against the right thing. */
export function albumAttention(album: Album, disabled: CheckKey[]): AlbumAttention {
  return trackAttention(album.tracks, [album], disabled);
}

/** The live verdict: flipping a check off in the Métadonnées popover re-renders
 * the tracklist that was dotting for it. */
export function useAlbumAttention(album: Album): AlbumAttention {
  const disabled = useDisabledChecks();
  return useMemo(() => albumAttention(album, disabled), [album, disabled]);
}

/**
 * The same verdict over a free-standing list — the inspection table's, which has
 * tracks from everywhere and no record of its own.
 *
 * No albums in scope: the album-level doors (artwork, tracklist gaps) name a
 * record, never a row, so nothing they return could reach a cell here. Passing
 * the library's albums would only make the queue do work whose result is
 * discarded on a list that can be thousands of rows long.
 */
export function useTrackAttention(tracks: LibraryTrack[]): AlbumAttention {
  const disabled = useDisabledChecks();
  return useMemo(() => trackAttention(tracks, [], disabled), [tracks, disabled]);
}
