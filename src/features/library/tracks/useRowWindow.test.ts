import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  everyRow,
  ROW_HEIGHT,
  windowFromSlices,
  type Slice,
} from "@/features/library/tracks/useRowWindow";

function makeTracks(n: number): LibraryTrack[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, title: `Track ${i}` })) as LibraryTrack[];
}

/** The slices a virtualizer scrolled to `from` would hand us. */
function slices(from: number, count: number): Slice[] {
  return Array.from({ length: count }, (_, i) => ({
    index: from + i,
    start: (from + i) * ROW_HEIGHT,
    end: (from + i + 1) * ROW_HEIGHT,
  }));
}

describe("everyRow", () => {
  it("mounts the whole list with no spacers", () => {
    const result = everyRow(makeTracks(120));

    expect(result.isVirtual).toBe(false);
    expect(result.rows).toHaveLength(120);
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(0);
  });

  it("numbers rows by their position in the list", () => {
    const result = everyRow(makeTracks(120));

    expect(result.rows[0].index).toBe(0);
    expect(result.rows[119].index).toBe(119);
  });

  it("handles an empty list", () => {
    expect(everyRow([]).rows).toHaveLength(0);
  });
});

describe("windowFromSlices", () => {
  const tracks = makeTracks(10_000);
  const total = tracks.length * ROW_HEIGHT;

  it("mounts only the slices it was given", () => {
    const result = windowFromSlices(tracks, slices(0, 25), total);

    expect(result.rows).toHaveLength(25);
    expect(result.isVirtual).toBe(true);
  });

  it("carries each row's position in the full list, not in the window", () => {
    const result = windowFromSlices(tracks, slices(4000, 25), total);

    expect(result.rows[0].index).toBe(4000);
    expect(result.rows[0].track).toBe(tracks[4000]);
    expect(result.rows[24].index).toBe(4024);
  });

  it("reserves the height of every row it did not mount", () => {
    const result = windowFromSlices(tracks, slices(4000, 25), total);

    // This is the invariant the scrollbar depends on: spacers plus mounted
    // rows always add up to the full list.
    const mounted = result.rows.length * ROW_HEIGHT;
    expect(result.paddingTop + mounted + result.paddingBottom).toBe(total);
  });

  it("puts no spacer above when scrolled to the top", () => {
    const result = windowFromSlices(tracks, slices(0, 25), total);

    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(total - 25 * ROW_HEIGHT);
  });

  it("puts no spacer below when scrolled to the very bottom", () => {
    const result = windowFromSlices(tracks, slices(9975, 25), total);

    expect(result.paddingBottom).toBe(0);
    expect(result.paddingTop).toBe(9975 * ROW_HEIGHT);
  });

  it("survives an empty slice list", () => {
    const result = windowFromSlices(tracks, [], total);

    expect(result.rows).toHaveLength(0);
    expect(result.paddingTop).toBe(0);
    expect(result.paddingBottom).toBe(0);
  });
});
