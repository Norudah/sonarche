import type { LibraryTrack } from "@/features/library/api";
import { COMPLETENESS_KEYS, toFieldValues, type FieldValues } from "@/features/library/metadata/fields";

/**
 * Completion, told as something you can act on.
 *
 * The old panel showed a percentage of filled cells next to a count of whole
 * tracks — two different definitions of "complete" a few centimetres apart, and
 * a number nobody could check. Here there is one definition, whole tracks, and
 * the ring states it as the ratio itself. The share is left to the arc.
 *
 * The gaps are the point: naming which field is missing, and on how many tracks,
 * is what turns a figure into a door. Same doctrine as the Metadata page.
 */

export interface FieldGap {
  field: keyof FieldValues;
  /** Tracks left with this field empty. */
  missing: number;
  /** Those tracks, in tracklist order. */
  trackIds: number[];
}

export interface AlbumCompletion {
  /** Tracks whose every counted field is filled. */
  complete: number;
  total: number;
  /** Fields with at least one hole, worst first. */
  gaps: FieldGap[];
  /** Fields that are whole, in panel order — stated so the user sees what they
   * no longer have to check. */
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
