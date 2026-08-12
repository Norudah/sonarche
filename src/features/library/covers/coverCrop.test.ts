import { describe, expect, it } from "vitest";

import {
  clamp01,
  clampZoom,
  cropRect,
  frameFits,
  frameSide,
  MAX_ZOOM,
  MIN_ZOOM,
  stageLayout,
  WHOLE_FRAME,
  type CropFrame,
} from "@/features/library/covers/coverCrop";

const frame = (over: Partial<CropFrame> = {}): CropFrame => ({ ...WHOLE_FRAME, ...over });

describe("cropRect", () => {
  it("returns null for a square source at full zoom — nothing to cut", () => {
    expect(cropRect({ width: 800, height: 800 }, WHOLE_FRAME)).toBeNull();
  });

  it("slides along the width of a landscape source", () => {
    const source = { width: 1000, height: 600 };
    expect(cropRect(source, frame({ x: 0 }))).toEqual({ left: 0, top: 0, size: 600 });
    expect(cropRect(source, frame())).toEqual({ left: 200, top: 0, size: 600 });
    expect(cropRect(source, frame({ x: 1 }))).toEqual({ left: 400, top: 0, size: 600 });
  });

  it("slides along the height of a portrait source", () => {
    expect(cropRect({ width: 600, height: 1000 }, frame({ y: 1 }))).toEqual({ left: 0, top: 400, size: 600 });
  });

  it("zooming in shrinks the window and frees both axes", () => {
    expect(cropRect({ width: 800, height: 800 }, frame({ zoom: 0.5 }))).toEqual({ left: 200, top: 200, size: 400 });
    expect(cropRect({ width: 800, height: 800 }, frame({ zoom: 0.5, x: 0, y: 1 }))).toEqual({
      left: 0,
      top: 400,
      size: 400,
    });
  });

  it("clamps a frame that left the picture rather than sending it outside", () => {
    // Nothing ships in this state — see frameFits — but the weight estimate
    // reads the rectangle on every keystroke.
    expect(cropRect({ width: 1000, height: 600 }, frame({ zoom: MAX_ZOOM }))).toEqual({
      left: 200,
      top: 0,
      size: 600,
    });
  });

  it("clamps a drifted offset instead of cropping outside the frame", () => {
    const source = { width: 1000, height: 600 };
    expect(cropRect(source, frame({ x: 1.4 }))).toEqual({ left: 400, top: 0, size: 600 });
    expect(cropRect(source, frame({ x: -0.2 }))).toEqual({ left: 0, top: 0, size: 600 });
  });
});

describe("frameFits", () => {
  it("holds up to the largest square and no further", () => {
    const source = { width: 1000, height: 600 };
    expect(frameFits(source, MIN_ZOOM)).toBe(true);
    expect(frameFits(source, 1)).toBe(true);
    expect(frameFits(source, 1.05)).toBe(false);
    expect(frameFits(source, MAX_ZOOM)).toBe(false);
  });

  it("is the short side that decides, on either orientation", () => {
    expect(frameSide({ width: 600, height: 1000 }, 1)).toBe(600);
    expect(frameSide({ width: 1000, height: 600 }, 0.5)).toBe(300);
  });
});

describe("stageLayout", () => {
  it("fits the long side to the stage and travels along it", () => {
    expect(stageLayout({ width: 1000, height: 600 }, WHOLE_FRAME, 280)).toMatchObject({
      width: 280,
      height: 168,
      imageLeft: 0,
      imageTop: 0,
      side: 168,
      travelX: 112,
      travelY: 0,
    });
  });

  it("travels vertically for a portrait source", () => {
    const layout = stageLayout({ width: 600, height: 1000 }, WHOLE_FRAME, 280);
    expect(layout.height).toBe(280);
    expect(layout.travelX).toBe(0);
    expect(layout.travelY).toBe(280 - layout.width);
  });

  it("a square source has no travel until it is zoomed into", () => {
    expect(stageLayout({ width: 800, height: 800 }, WHOLE_FRAME, 280)).toMatchObject({ travelX: 0, travelY: 0 });
    expect(stageLayout({ width: 800, height: 800 }, frame({ zoom: 0.5 }), 280)).toMatchObject({
      side: 140,
      travelX: 140,
      travelY: 140,
    });
  });

  it("keeps the picture still while the window is inside it", () => {
    const source = { width: 1000, height: 600 };
    const left = stageLayout(source, frame({ x: 0 }), 280);
    const right = stageLayout(source, frame({ x: 1 }), 280);
    expect([left.imageLeft, right.imageLeft]).toEqual([0, 0]);
    expect([left.left, right.left]).toEqual([0, 112]);
  });

  it("pins the window and moves the picture once the frame is wider than it", () => {
    const source = { width: 800, height: 800 };
    const zoomedOut = frame({ zoom: MAX_ZOOM });
    // Union is the window — a 920px square scaled to the 280px stage — and the
    // picture is the thing left with room to slide.
    const centred = stageLayout(source, zoomedOut, 280);
    expect(centred).toMatchObject({ width: 280, height: 280, side: 280, left: 0, top: 0 });
    expect(centred.imageLeft).toBe(18);

    const pulled = stageLayout(source, { ...zoomedOut, x: 1 }, 280);
    expect(pulled.left).toBe(0);
    expect(pulled.imageLeft).toBe(37);
  });

  it("survives a degenerate zero-size image", () => {
    expect(stageLayout({ width: 0, height: 0 }, WHOLE_FRAME, 280)).toMatchObject({ travelX: 0, travelY: 0 });
  });
});

describe("clamps", () => {
  it("holds the offsets inside 0…1 and the zoom inside its range", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(0.8)).toBe(0.8);
  });
});
