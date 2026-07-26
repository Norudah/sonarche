import type { LibraryTrack } from "@/features/library/api";

/** The sortable columns of the tracks table. `#` is absent on purpose: it
 * numbers the current order, so it has no order of its own to offer. */
export const TRACK_SORT_KEYS = ["title", "artist", "album", "genre", "length"] as const;
export type TrackSortKey = (typeof TRACK_SORT_KEYS)[number];

export interface TrackSort {
  key: TrackSortKey;
  dir: "asc" | "desc";
}

/**
 * What clicking a column header does next.
 *
 * A fresh column starts ascending — text reads A→Z, and a duration list reads
 * shortest first. Clicking the active column flips it, and clicking it a third
 * time drops the sort entirely rather than cycling back to ascending: the
 * library's own order is a state the user must be able to get back to, and the
 * header is the only control that could return them to it.
 */
export function nextSort(current: TrackSort | null, key: TrackSortKey): TrackSort | null {
  if (current?.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** Missing values sink in both directions rather than pretending to be an empty
 * string or a zero-second track — the same doctrine as `sortAlbums` on an
 * undated album. Absence is not a value to be ranked among the others. */
function compare(a: LibraryTrack, b: LibraryTrack, key: TrackSortKey): number {
  if (key === "length") {
    if (a.length == null || b.length == null) return 0;
    return a.length - b.length;
  }
  if (key === "genre") {
    if (!a.genre || !b.genre) return 0;
    return a.genre.localeCompare(b.genre);
  }
  return a[key].localeCompare(b[key]);
}

function sinks(track: LibraryTrack, key: TrackSortKey): boolean {
  if (key === "length") return track.length == null;
  if (key === "genre") return !track.genre;
  return !track[key];
}

/**
 * Ordering happens on the front because the whole library already lives here —
 * a round-trip to the sidecar to reorder an array we hold would be slower than
 * the sort itself.
 *
 * `null` returns the input array *by reference*, which is what keeps "no sort"
 * free: the default state must not allocate a copy of every track on each
 * render. Ties keep the incoming order (`Array.prototype.sort` is stable), so
 * sorting by genre leaves each genre's block in the order the library gave it
 * rather than shuffling it.
 */
export function sortTracks(tracks: LibraryTrack[], sort: TrackSort | null): LibraryTrack[] {
  if (sort == null) return tracks;

  const direction = sort.dir === "asc" ? 1 : -1;
  return [...tracks].sort((a, b) => {
    const aSinks = sinks(a, sort.key);
    const bSinks = sinks(b, sort.key);
    if (aSinks !== bSinks) return aSinks ? 1 : -1;
    return compare(a, b, sort.key) * direction;
  });
}
