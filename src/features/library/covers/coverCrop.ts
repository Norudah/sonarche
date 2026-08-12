import type { CoverCrop } from "@/features/library/api";

/**
 * Crop math for the image replacement modals, kept apart from the components so
 * the pixel arithmetic — the part a one-off rounding error would quietly ruin —
 * is testable without a DOM.
 *
 * The model is three numbers. `zoom` sizes the square window as a fraction of
 * the source's short side (1 is the largest square the picture holds), and
 * `x`/`y` say where that window sits, 0…1 along each axis. Everything else —
 * the on-screen geometry, the pixel rectangle sent to the sidecar — derives
 * from them.
 *
 * A zoom above 1 asks for a window wider than the picture, which is the one
 * thing this cannot deliver: what would come back is letterboxed, and a cover
 * has to be square. The frame is allowed to go there anyway — refusing to move
 * is how an interface fails to explain itself — and `frameFits` is what the
 * modals disable their confirm on.
 */

export interface SourceSize {
  width: number;
  height: number;
}

/** Where the square window sits over the source, and how big it is. */
export interface CropFrame {
  /** Window side as a fraction of the source's short side. 1 = the largest
   * square; below, zoomed in; above, the frame leaves the picture. */
  zoom: number;
  /** 0…1 along the width — 0.5 is centred. No effect on an axis with no play. */
  x: number;
  /** 0…1 along the height. */
  y: number;
}

/** The whole picture, centred: what a freshly picked image opens on. */
export const WHOLE_FRAME: CropFrame = { zoom: 1, x: 0.5, y: 0.5 };

/** Below this the crop stops being a crop and becomes a detail; a 600px source
 * at 0.3 already lands under the 500px the display rendition wants. */
export const MIN_ZOOM = 0.3;

/** Enough overshoot past the largest square for the frame to visibly leave the
 * picture — that overflow is the explanation, the warning only names it. Kept
 * short: past this point the slider is offering travel nothing can be confirmed
 * from, and a sixth of the track is already plenty to hit by accident. */
export const MAX_ZOOM = 1.15;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The window's side in source pixels. */
export function frameSide(source: SourceSize, zoom: number): number {
  return Math.round(clampZoom(zoom) * Math.min(source.width, source.height));
}

/** Whether the window is entirely inside the picture — what a square cover
 * needs, and the only thing standing between the frame and the confirm button. */
export function frameFits(source: SourceSize, zoom: number): boolean {
  return frameSide(source, zoom) <= Math.min(source.width, source.height);
}

/**
 * The square cut from the source, in source pixels — or null when the frame is
 * the whole picture and there is nothing to cut.
 *
 * A frame larger than the picture is clamped back into it rather than sent as
 * negative offsets (the wire type is unsigned, and the sidecar clamps too).
 * Nothing ships in that state — `frameFits` blocks it upstream — but the weight
 * estimate reads this on every keystroke, and it has to stay answerable.
 */
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
 * The crop stage's on-screen geometry, in CSS pixels.
 *
 * The box drawn is the union of the picture and the window, scaled so its long
 * side is `maxPx`. While the window is inside the picture that union *is* the
 * picture — the image holds still and the frame slides over it, which is what
 * the stage has always done. Past that, the union is the window: the frame
 * holds still instead and the picture slides under it, its edges coming into
 * view. The switch is continuous, and in both regimes what the pointer drags
 * follows the pointer.
 */
export interface StageLayout {
  /** The box, and the frame both live in it. */
  width: number;
  height: number;
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
  /** The window, positioned inside the box. */
  left: number;
  top: number;
  side: number;
  /** How far the window can travel on each axis, in CSS px. 0 = no play. */
  travelX: number;
  travelY: number;
}

/** Rounds to whole CSS pixels, and folds `-0` back to `0` — the sign survives
 * `Math.round` and turns up in comparisons. */
function px(value: number): number {
  return Math.round(value) || 0;
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

  // Signed on purpose: negative once the window is wider than the picture,
  // which is exactly when the picture is the thing that moves.
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
