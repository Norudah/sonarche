import { describe, expect, it } from "vitest";

import { moveItem, rowShift, targetIndex } from "@/features/library/playlists/reorder";

describe("targetIndex", () => {
  it("moves one row per row height, rounding to the nearest", () => {
    expect(targetIndex(2, 0, 40, 10)).toBe(2);
    expect(targetIndex(2, 19, 40, 10)).toBe(2);
    expect(targetIndex(2, 21, 40, 10)).toBe(3);
    expect(targetIndex(2, -85, 40, 10)).toBe(0);
  });

  it("clamps to the list's ends", () => {
    expect(targetIndex(2, -500, 40, 10)).toBe(0);
    expect(targetIndex(2, 500, 40, 10)).toBe(9);
  });

  it("stays put on degenerate geometry", () => {
    expect(targetIndex(2, 100, 0, 10)).toBe(2);
    expect(targetIndex(0, 100, 40, 0)).toBe(0);
  });
});

describe("rowShift", () => {
  it("shifts up the rows the drag passes over on the way down", () => {
    // Dragging row 1 down to 3: rows 2 and 3 each move up one slot.
    expect(rowShift(0, 1, 3, 40)).toBe(0);
    expect(rowShift(1, 1, 3, 40)).toBe(0);
    expect(rowShift(2, 1, 3, 40)).toBe(-40);
    expect(rowShift(3, 1, 3, 40)).toBe(-40);
    expect(rowShift(4, 1, 3, 40)).toBe(0);
  });

  it("shifts down the rows the drag passes over on the way up", () => {
    // Dragging row 3 up to 1: rows 1 and 2 each move down one slot.
    expect(rowShift(0, 3, 1, 40)).toBe(0);
    expect(rowShift(1, 3, 1, 40)).toBe(40);
    expect(rowShift(2, 3, 1, 40)).toBe(40);
    expect(rowShift(3, 3, 1, 40)).toBe(0);
  });

  it("shifts nothing when the drag has not left its slot", () => {
    for (let index = 0; index < 5; index += 1) {
      expect(rowShift(index, 2, 2, 40)).toBe(0);
    }
  });
});

describe("moveItem", () => {
  it("lands the item at the target and keeps the rest in order", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it("returns the list untouched on a no-op or out-of-range move", () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 0, 9)).toBe(list);
  });
});
