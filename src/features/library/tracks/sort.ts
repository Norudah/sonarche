import type { LibraryTrack } from "@/features/library/api";

/** `#` numbers the current order, so it isn't sortable. */
export const TRACK_SORT_KEYS = ["title", "artist", "album", "genre", "length"] as const;
export type TrackSortKey = (typeof TRACK_SORT_KEYS)[number];

export interface TrackSort {
  key: TrackSortKey;
  dir: "asc" | "desc";
}

/** Ascending, then descending, then no sort (back to library order). */
export function nextSort(current: TrackSort | null, key: TrackSortKey): TrackSort | null {
  if (current?.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** Missing values sink in both directions. */
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

/** Sorted on the front. `null` returns the input by reference; the sort is
 * stable, so ties keep library order. */
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
