import type { LibraryTrack } from "@/features/library/api";
import { COMPLETENESS_KEYS, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";

/** Completion in whole tracks, with the missing fields and where they are. */

export interface FieldGap {
  field: keyof FieldValues;
  /** Tracks missing this field. */
  missing: number;
  /** In tracklist order. */
  trackIds: number[];
}

export interface AlbumCompletion {
  /** Tracks with every counted field filled. */
  complete: number;
  total: number;
  /** Worst first. */
  gaps: FieldGap[];
  /** Complete fields, in panel order. */
  filled: (keyof FieldValues)[];
  incompleteIds: number[];
}

export function albumCompletion(tracks: LibraryTrack[]): AlbumCompletion {
  const holes = new Map<keyof FieldValues, number[]>();
  const incompleteIds: number[] = [];
  let complete = 0;

  for (const track of tracks) {
    const values = toFieldValues(track);
    let whole = true;
    for (const field of COMPLETENESS_KEYS) {
      if (values[field].trim() !== "") continue;
      whole = false;
      const ids = holes.get(field);
      if (ids) ids.push(track.id);
      else holes.set(field, [track.id]);
    }
    if (whole) complete += 1;
    else incompleteIds.push(track.id);
  }

  const gaps = [...holes.entries()]
    .map(([field, trackIds]) => ({ field, missing: trackIds.length, trackIds }))
    .sort((a, b) => b.missing - a.missing || COMPLETENESS_KEYS.indexOf(a.field) - COMPLETENESS_KEYS.indexOf(b.field));

  return {
    complete,
    total: tracks.length,
    gaps,
    filled: COMPLETENESS_KEYS.filter((field) => !holes.has(field)),
    incompleteIds,
  };
}
