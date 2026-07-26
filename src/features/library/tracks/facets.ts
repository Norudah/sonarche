import type { LibraryTrack } from "@/features/library/api";
import { FAMILY_NONE, FAMILY_OTHER, familyKeyOf } from "@/features/library/genres/genres";

/** One choice in a facet menu: the stored value and how many tracks carry it. */
export interface FacetOption<T extends string | number> {
  value: T;
  trackCount: number;
}

/** The option lists behind the explorer's filter bar. */
export interface TrackFacets {
  /**
   * Real genre families only — the two sentinels are deliberately absent.
   *
   * `__none__` and `__other__` are corrections, not places: they already have
   * their own triage filters ("sans genre", "hors arbre") in the panel, and
   * listing them here would have put the same two sets behind two controls of
   * opposite meaning. The pastille browses, the panel fixes.
   */
  families: FacetOption<string>[];
  categories: FacetOption<string>[];
  /** Decades present in the library, most recent first. Undated tracks are not
   * a decade — the panel's "sans année" filter is their door. */
  decades: FacetOption<number>[];
}

/** The decade a year falls in, as its first year: 1994 → 1990. Shared with the
 * filter so the menu and the predicate can never disagree on a boundary. */
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

/** Largest first, ties on the value — never on iteration order, which would let
 * two options swap places between renders of the same library. */
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
    // Chronological, newest first: a decade list is a timeline, and ordering it
    // by size would scatter the eighties between the 2010s and the 2000s.
    decades: Array.from(decades.entries())
      .map(([value, trackCount]) => ({ value, trackCount }))
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * Cached on the array's identity, not memoised per component.
 *
 * `useMemo` is per consumer, and the same library feeds the explorer plus every
 * scoped page: five mounted callers meant five passes over the same thousands of
 * tracks. A `WeakMap` keyed on the array React Query handed out gives the first
 * caller's work to the other four, and a refetch produces a new array — so the
 * entry invalidates itself with no bookkeeping, and the old one is collectable.
 *
 * The counts describe the scope, not the current filter combination: proper
 * faceted counts (how many are left *given the other filters*) cannot be cached
 * on the array alone, and would cost a pass per menu per keystroke. Worth
 * revisiting only if the flat counts read as wrong in practice.
 */
const cache = new WeakMap<LibraryTrack[], TrackFacets>();

export function facetsOf(tracks: LibraryTrack[]): TrackFacets {
  const hit = cache.get(tracks);
  if (hit) return hit;

  const computed = computeFacets(tracks);
  cache.set(tracks, computed);
  return computed;
}
