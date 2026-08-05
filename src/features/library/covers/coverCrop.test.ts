import { describe, expect, it } from "vitest";

import { clampOffset, cropRect, previewShift } from "@/features/library/covers/coverCrop";

describe("cropRect", () => {
  it("returns null for a square source — nothing to choose", () => {
    expect(cropRect({ width: 800, height: 800 }, 0.5)).toBeNull();
  });

  it("slides along the width of a landscape source", () => {
    expect(cropRect({ width: 1000, height: 600 }, 0)).toEqual({ left: 0, top: 0, size: 600 });
    expect(cropRect({ width: 1000, height: 600 }, 0.5)).toEqual({ left: 200, top: 0, size: 600 });
    expect(cropRect({ width: 1000, height: 600 }, 1)).toEqual({ left: 400, top: 0, size: 600 });
  });

  it("slides along the height of a portrait source", () => {
    expect(cropRect({ width: 600, height: 1000 }, 1)).toEqual({ left: 0, top: 400, size: 600 });
  });

  it("clamps a drifted offset instead of cropping outside the frame", () => {
    expect(cropRect({ width: 1000, height: 600 }, 1.4)).toEqual({ left: 400, top: 0, size: 600 });
    expect(cropRect({ width: 1000, height: 600 }, -0.2)).toEqual({ left: 0, top: 0, size: 600 });
  });
});

describe("previewShift", () => {
  it("is the crop's travel as a fraction of the long side", () => {
    expect(previewShift({ width: 1000, height: 600 }, 0)).toBe(0);
    expect(previewShift({ width: 1000, height: 600 }, 1)).toBeCloseTo(0.4);
    expect(previewShift({ width: 1000, height: 600 }, 0.5)).toBeCloseTo(0.2);
  });

  it("survives a degenerate zero-size image", () => {
    expect(previewShift({ width: 0, height: 0 }, 0.5)).toBe(0);
  });
});

describe("clampOffset", () => {
  it("holds the slider inside 0…1", () => {
    expect(clampOffset(-1)).toBe(0);
    expect(clampOffset(2)).toBe(1);
    expect(clampOffset(0.3)).toBe(0.3);
  });
});
