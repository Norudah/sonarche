import { describe, expect, it } from "vitest";

import { activeLineIndex, type LyricLine } from "@/shared/player/lyrics";

const lines: LyricLine[] = [
  { time: 10, text: "First" },
  { time: 20, text: "Second" },
  { time: 30, text: "Third" },
];

describe("activeLineIndex", () => {
  it("returns -1 before the first line", () => {
    expect(activeLineIndex(lines, 4)).toBe(-1);
  });

  it("holds a line until the next one starts", () => {
    expect(activeLineIndex(lines, 19.9)).toBe(0);
    expect(activeLineIndex(lines, 20)).toBe(1);
  });

  it("keeps the last line to the end of the track", () => {
    expect(activeLineIndex(lines, 600)).toBe(2);
  });

  it("has no active line in an empty set", () => {
    expect(activeLineIndex([], 12)).toBe(-1);
  });
});
