import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { LibraryTrack } from "@/features/library/api";
import { withParam } from "@/features/library/queryParams";
import { facetsOf, type TrackFacets } from "@/features/library/tracks/facets";
import { filterTracks } from "@/features/library/tracks/filter";
import { nextSort, sortTracks, type TrackSort, type TrackSortKey } from "@/features/library/tracks/sort";
import { applyTrackTriage, parseTrackTriage, type TrackTriage } from "@/features/library/tracks/triage";

/** Axes a surface owns. A scoped page's own axis (a genre page's genre) isn't
 * offered or re-read from the URL. Panel axes apply everywhere. */
export type TrackAxis = "family" | "genre" | "category";

/** The library-wide explorer's axes. */
const ALL_AXES: readonly TrackAxis[] = ["family", "genre", "category"];

/** Drops unowned axes so the page's own param isn't read as a filter. */
export function restrictTriage(triage: TrackTriage, axes: readonly TrackAxis[]): TrackTriage {
  return {
    ...triage,
    family: axes.includes("family") ? triage.family : null,
    genre: axes.includes("genre") ? triage.genre : null,
    category: axes.includes("category") ? triage.category : null,
  };
}

export interface TrackFilterState {
  /** Filtered, searched and sorted: what is shown and played. */
  visible: LibraryTrack[];
  /** Before filters, for "37 of 1 248". */
  scopeSize: number;
  triage: TrackTriage;
  facets: TrackFacets;
  axes: readonly TrackAxis[];
  query: string;
  setQuery: (value: string) => void;
  sort: TrackSort | null;
  /** See `nextSort`. */
  toggleSort: (key: TrackSortKey) => void;
  /** `null` clears it. */
  setParam: (name: string, value: string | null) => void;
  /** Re-keys the table (cascade, scroll to top). */
  animationKey: string;
}

/** Explorer state over a caller-reduced scope. Filters live in the URL; search
 * and sort in component state. */
export function useTrackFilter(tracks: LibraryTrack[], axes: readonly TrackAxis[] = ALL_AXES): TrackFilterState {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TrackSort | null>(null);

  const triage = useMemo(() => restrictTriage(parseTrackTriage(params), axes), [params, axes]);
  // `facetsOf` caches by array identity; no memo needed.
  const facets = facetsOf(tracks);

  const filtered = useMemo(() => applyTrackTriage(tracks, triage), [tracks, triage]);
  const searched = useMemo(() => filterTracks(filtered, query), [filtered, query]);
  const visible = useMemo(() => sortTracks(searched, sort), [searched, sort]);

  return {
    visible,
    scopeSize: tracks.length,
    triage,
    facets,
    axes,
    query,
    setQuery,
    sort,
    toggleSort: (key) => setSort((current) => nextSort(current, key)),
    // `replace`: a filter refines the current entry.
    setParam: (name, value) => setParams(withParam(params, name, value), { replace: true }),
    animationKey: `${params.toString()}:${query}:${sort?.key ?? ""}${sort?.dir ?? ""}`,
  };
}
