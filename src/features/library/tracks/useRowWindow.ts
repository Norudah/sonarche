import { useVirtualizer } from "@tanstack/react-virtual";

import type { LibraryTrack } from "@/features/library/api";
import { useScrollport } from "@/shared/ui/Scrollport";

/** Measured, including border-spacing; a wrong value skews the scrollbar. */
export const ROW_HEIGHT = 58;

/** Measured: the edit button is the tallest thing in the row. */
export const INSPECT_ROW_HEIGHT = 32;

/** Below this, all rows mount: the cascade plays once and find-in-page works. */
const VIRTUALIZE_ABOVE = 150;

/** Rows kept beyond each edge for fast scrolling. */
const OVERSCAN = 12;

interface RowWindow {
  /** Each with its index in the full list, which the row displays. */
  rows: { track: LibraryTrack; index: number }[];
  /** Spacer height; zero when not virtualizing. */
  paddingTop: number;
  paddingBottom: number;
  isVirtual: boolean;
}

/** Declared here so the pure part is testable without a virtualizer. */
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

/** Visible rows plus spacer heights that always add up to the full list height. */
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

/** Virtualizes long track lists (10 000 rows were 350 000 DOM nodes) against
 * the shared scrollport. */
export function useRowWindow(tracks: LibraryTrack[], rowHeight: number = ROW_HEIGHT): RowWindow {
  const scrollport = useScrollport();
  const isVirtual = tracks.length > VIRTUALIZE_ABOVE;

  const virtualizer = useVirtualizer({
    // Zero disables measuring; the hook itself must still run.
    count: isVirtual ? tracks.length : 0,
    getScrollElement: () => scrollport.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  if (!isVirtual) return everyRow(tracks);

  return windowFromSlices(tracks, virtualizer.getVirtualItems(), virtualizer.getTotalSize());
}
