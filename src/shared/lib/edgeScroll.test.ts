import { describe, expect, it } from "vitest";

import { edgeScrollSpeed } from "@/shared/lib/edgeScroll";

describe("edgeScrollSpeed", () => {
  it("is zero in the middle of the scrollport", () => {
    expect(edgeScrollSpeed(500, 0, 1000)).toBe(0);
  });

  it("ramps up toward each edge, signed by direction", () => {
    expect(edgeScrollSpeed(10, 0, 1000)).toBeLessThan(edgeScrollSpeed(40, 0, 1000));
    expect(edgeScrollSpeed(10, 0, 1000)).toBeLessThan(0);
    expect(edgeScrollSpeed(990, 0, 1000)).toBeGreaterThan(0);
  });

  it("caps at the configured maximum even past the edge", () => {
    expect(edgeScrollSpeed(-100, 0, 1000, 56, 14)).toBe(-14);
    expect(edgeScrollSpeed(1100, 0, 1000, 56, 14)).toBe(14);
  });
});
