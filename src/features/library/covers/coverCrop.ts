import type { CoverCrop } from "@/features/library/api";

/**
 * Pure crop math for the image modals. A frame is `zoom` (window side as a
 * fraction of the source's short side, 1 = largest square) plus `x`/`y`
 * (0…1 position). Zoom above 1 leaves the picture and can't be confirmed
 * (`frameFits`).
 */

export interface SourceSize {
  width: number;
  height: number;
}

export interface CropFrame {
  /** Fraction of the short side: 1 = largest square, above 1 leaves the picture. */
  zoom: number;
  /** 0…1 along the width; 0.5 is centred. */
  x: number;
  /** 0…1 along the height. */
  y: number;
}

/** Whole picture, centred. */
export const WHOLE_FRAME: CropFrame = { zoom: 1, x: 0.5, y: 0.5 };

/** A 600px source at 0.3 is already below the 500px rendition. */
export const MIN_ZOOM = 0.3;

/** Enough overshoot to visibly leave the picture, not more. */
export const MAX_ZOOM = 1.15;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** In source pixels. */
export function frameSide(source: SourceSize, zoom: number): number {
  return Math.round(clampZoom(zoom) * Math.min(source.width, source.height));
}

/** Whether the window is inside the picture (required to confirm). */
export function frameFits(source: SourceSize, zoom: number): boolean {
  return frameSide(source, zoom) <= Math.min(source.width, source.height);
}

/** The square to cut in source pixels, or null for the whole picture.
 * Oversized frames are clamped (the weight estimate still reads them). */
export function cropRect(source: SourceSize, frame: CropFrame): CoverCrop | null {
  const { width, height } = source;
  const size = Math.min(frameSide(source, frame.zoom), width, height);
  if (size === width && size === height) return null;
  return {
    left: Math.round(clamp01(frame.x) * (width - size)),
    top: Math.round(clamp01(frame.y) * (height - size)),
    size,
  };
}

/**
 * On-screen stage geometry (CSS px): the union of picture and window, long
 * side `maxPx`. Inside the picture, the window moves over a still image;
 * beyond it, the window holds still and the picture moves.
 */
export interface StageLayout {
  width: number;
  height: number;
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
  /** The window, inside the box. */
  left: number;
  top: number;
  side: number;
  /** Window travel per axis in CSS px; 0 = no play. */
  travelX: number;
  travelY: number;
}

/** Rounds to quarter pixels and folds `-0` to `0`. */
function px(value: number): number {
  return Math.round(value * 4) / 4 || 0;
}

export function stageLayout(source: SourceSize, frame: CropFrame, maxPx: number): StageLayout {
  const { width, height } = source;
  const empty = {
    width: maxPx,
    height: maxPx,
    imageLeft: 0,
    imageTop: 0,
    imageWidth: maxPx,
    imageHeight: maxPx,
    left: 0,
    top: 0,
    side: maxPx,
    travelX: 0,
    travelY: 0,
  };
  if (width === 0 || height === 0) return empty;

  const size = frameSide(source, frame.zoom);
  const unionWidth = Math.max(width, size);
  const unionHeight = Math.max(height, size);
  const scale = maxPx / Math.max(unionWidth, unionHeight);

  // Negative once the window is wider than the picture.
  const windowX = clamp01(frame.x) * (width - size);
  const windowY = clamp01(frame.y) * (height - size);
  const originX = Math.min(0, windowX);
  const originY = Math.min(0, windowY);

  return {
    width: px(unionWidth * scale),
    height: px(unionHeight * scale),
    imageLeft: px(-originX * scale),
    imageTop: px(-originY * scale),
    imageWidth: px(width * scale),
    imageHeight: px(height * scale),
    left: px((windowX - originX) * scale),
    top: px((windowY - originY) * scale),
    side: px(size * scale),
    travelX: px(Math.abs(width - size) * scale),
    travelY: px(Math.abs(height - size) * scale),
  };
}
