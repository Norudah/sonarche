import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { LibraryTrack } from "@/features/library/api";
import { withParam } from "@/features/library/queryParams";
import { facetsOf, type TrackFacets } from "@/features/library/tracks/facets";
import { filterTracks } from "@/features/library/tracks/filter";
import { nextSort, sortTracks, type TrackSort, type TrackSortKey } from "@/features/library/tracks/sort";
import { applyTrackTriage, parseTrackTriage, type TrackTriage } from "@/features/library/tracks/triage";

/**
 * The axes a surface offers on its own.
 *
 * A scoped page has already answered one of them — a genre page is a family and
 * a genre — so it must not offer it again, and must not re-read it out of the
 * URL where the *page* stores it. Declaring what each surface owns is what lets
 * one explorer serve the library and four subjects without a flag per page.
 *
 * The panel's axes (decade, and the correction filters) are not listed: they are
 * refinements of any scope, so every surface carries them.
 */
export type TrackAxis = "family" | "genre" | "category";

/** Everything the library-wide explorer owns — the default scope. */
const ALL_AXES: readonly TrackAxis[] = ["family", "genre", "category"];

/** Drops the axes this surface does not own, so a param the *page* uses for its
 * own scope (`?genre=` on a genre page) cannot be read a second time as a filter
 * and grow a chip that undoes the page. */
export function restrictTriage(triage: TrackTriage, axes: readonly TrackAxis[]): TrackTriage {
  return {
    ...triage,
    family: axes.includes("family") ? triage.family : null,
    genre: axes.includes("genre") ? triage.genre : null,
    category: axes.includes("category") ? triage.category : null,
  };
}

export interface TrackFilterState {
  /** Filtered, searched and sorted — what the table shows and what plays. */
  visible: LibraryTrack[];
  /** Size of the scope before any filter, for the "37 of 1 248" line. */
  scopeSize: number;
  triage: TrackTriage;
  facets: TrackFacets;
  axes: readonly TrackAxis[];
  query: string;
  setQuery: (value: string) => void;
  sort: TrackSort | null;
  /** One click on a column header — see `nextSort`. */
  toggleSort: (key: TrackSortKey) => void;
  /** Writes one filter into the URL, or clears it with `null`. */
  setParam: (name: string, value: string | null) => void;
  /** What the current result set is a result *of* — re-keys the table so the
   * rows cascade in and the scrollport returns to the top. */
  animationKey: string;
}

/**
 * The explorer's whole state, over a scope the caller has already reduced.
 *
 * `tracks` is a prop rather than something read from `useLibrary` here: the
 * scoped pages hand over an artist's or a genre's tracks, and a hook that went
 * looking for the library itself would filter the whole thing a second time.
 *
 * Filters live in the URL (shareable, and they survive opening an album and
 * coming back), search and sort in component state. Search is transient and
 * per-keystroke — the history is not a keylogger — and sort follows the albums
 * and artists shelves, which keep theirs local too.
 */
export function useTrackFilter(tracks: LibraryTrack[], axes: readonly TrackAxis[] = ALL_AXES): TrackFilterState {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TrackSort | null>(null);

  const triage = useMemo(() => restrictTriage(parseTrackTriage(params), axes), [params, axes]);
  // No `useMemo`: `facetsOf` caches on the array's identity, which every mounted
  // caller shares — a memo per component would only add a second cache.
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
    // `replace`: a filter refines the entry we are on, it is not a new place.
    // Pushing meant six flips buried the page you arrived from under six
    // entries, and getting out took six presses that each appeared to do
    // nothing — the same reasoning as the genre chips.
    setParam: (name, value) => setParams(withParam(params, name, value), { replace: true }),
    animationKey: `${params.toString()}:${query}:${sort?.key ?? ""}${sort?.dir ?? ""}`,
  };
}
