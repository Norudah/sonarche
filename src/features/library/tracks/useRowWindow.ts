import { useVirtualizer } from "@tanstack/react-virtual";

import type { LibraryTrack } from "@/features/library/api";
import { useScrollport } from "@/shared/ui/Scrollport";

/** Row height in px, including the table's vertical border-spacing. Rows are
 * uniform: one line of text next to a fixed-size cover. Measured, not guessed —
 * a wrong value here makes the scrollbar lie about the list's length. */
export const ROW_HEIGHT = 58;

/**
 * Below this, every row is mounted as before. A few hundred rows cost nothing,
 * and the plain table keeps what virtualization takes away: the row cascade
 * plays once instead of re-firing whenever a row scrolls back in, and the
 * browser's own find-in-page can still reach every title.
 */
export const VIRTUALIZE_ABOVE = 150;

/** Rows kept mounted beyond each edge, so a fast scroll meets rendered rows
 * rather than blank space. */
const OVERSCAN = 12;

export interface RowWindow {
  /** The tracks to render, each with its position in the full list — the index
   * is what the row displays, so it must survive the windowing. */
  rows: { track: LibraryTrack; index: number }[];
  /** Height of the spacer above and below the window. Zero when not
   * virtualizing, which is what lets both modes share one render path. */
  paddingTop: number;
  paddingBottom: number;
  isVirtual: boolean;
}

/** What the virtualizer tells us about one row on screen. Declared here rather
 * than imported so the pure part can be exercised without one. */
export interface Slice {
  index: number;
  start: number;
  end: number;
}

export function everyRow(tracks: LibraryTrack[]): RowWindow {
  return {
    rows: tracks.map((track, index) => ({ track, index })),
    paddingTop: 0,
    paddingBottom: 0,
    isVirtual: false,
  };
}

/**
 * Turn the virtualizer's visible slices into rows plus the spacer heights that
 * stand in for everything left out.
 *
 * The two paddings are what keep the scrollbar honest: mounted rows plus
 * spacers must always add up to the full list's height, otherwise the page
 * claims to be shorter than it is and the scroll position drifts.
 */
export function windowFromSlices(tracks: LibraryTrack[], slices: Slice[], totalSize: number): RowWindow {
  const first = slices[0];
  const last = slices[slices.length - 1];

  return {
    rows: slices.map((slice) => ({ track: tracks[slice.index], index: slice.index })),
    paddingTop: first ? first.start : 0,
    paddingBottom: last ? totalSize - last.end : 0,
    isVirtual: true,
  };
}

/**
 * The slice of a tracklist worth putting in the DOM.
 *
 * A library-wide tracklist mounts one row per track, and a row is ~35 elements
 * with a cover: 10 000 tracks meant 350 000 DOM nodes for the ~13 rows that fit
 * on screen. This keeps the mounted count flat no matter how big the library
 * gets.
 *
 * Scrolling happens on <main>, not on a container of ours, so the virtualizer
 * is pointed at the shared scrollport rather than a local ref.
 */
export function useRowWindow(tracks: LibraryTrack[]): RowWindow {
  const scrollport = useScrollport();
  const isVirtual = tracks.length > VIRTUALIZE_ABOVE;

  const virtualizer = useVirtualizer({
    // Zero disables the measuring work entirely for small libraries; the hook
    // itself still runs unconditionally, as hooks must.
    count: isVirtual ? tracks.length : 0,
    getScrollElement: () => scrollport.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  if (!isVirtual) return everyRow(tracks);

  return windowFromSlices(tracks, virtualizer.getVirtualItems(), virtualizer.getTotalSize());
}
