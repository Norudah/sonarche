import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, FAMILY_OTHER, familyKeyOf } from "@/features/library/genres/genres";

export interface FacetOption<T extends string | number> {
  value: T;
  trackCount: number;
}

/** Options behind the filter bar. */
export interface TrackFacets {
  /** Real families only: the `__none__` / `__other__` sentinels are panel filters. */
  families: FacetOption<string>[];
  categories: FacetOption<string>[];
  /** Newest first; undated tracks use the panel's "no year" filter. */
  decades: FacetOption<number>[];
}

/** 1994 → 1990. Shared with the filter so boundaries agree. */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function tally<T>(tracks: LibraryTrack[], keyOf: (track: LibraryTrack) => T | null): Map<T, number> {
  const counts = new Map<T, number>();
  for (const track of tracks) {
    const key = keyOf(track);
    if (key == null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Largest first, ties by value (stable across renders). */
function bySize<T extends string>(counts: Map<T, number>): FacetOption<T>[] {
  return Array.from(counts.entries())
    .map(([value, trackCount]) => ({ value, trackCount }))
    .sort((a, b) => b.trackCount - a.trackCount || a.value.localeCompare(b.value));
}

function computeFacets(tracks: LibraryTrack[]): TrackFacets {
  const families = tally(tracks, (track) => {
    const key = familyKeyOf(track);
    return key === FAMILY_NONE || key === FAMILY_OTHER ? null : key;
  });
  const categories = tally(tracks, (track) => track.category || null);
  const decades = tally(tracks, (track) => (track.year == null ? null : decadeOf(track.year)));

  return {
    families: bySize(families),
    categories: bySize(categories),
    // Chronological: a timeline.
    decades: Array.from(decades.entries())
      .map(([value, trackCount]) => ({ value, trackCount }))
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * Cached per listing array, shared by every page using the same library.
 * Counts describe the scope, not the current filter combination (true
 * faceted counts can't be cached this way).
 */
const cache = new WeakMap<LibraryTrack[], TrackFacets>();

export function facetsOf(tracks: LibraryTrack[]): TrackFacets {
  const hit = cache.get(tracks);
  if (hit) return hit;

  const computed = computeFacets(tracks);
  cache.set(tracks, computed);
  return computed;
}
