import type { CoverCrop } from "@/features/library/api";

/**
 * Crop math for the cover replacement modal, kept apart from the component so
 * the pixel arithmetic — the part a one-off rounding error would quietly ruin —
 * is testable without a DOM.
 *
 * The model is one number: `offset`, 0…1 along the source's long axis, where
 * the square window sits. Everything else (the CSS translation of the preview,
 * the pixel rectangle sent to the sidecar) derives from it.
 */

export interface SourceSize {
  width: number;
  height: number;
}

/** The square cut from the source at this offset, in source pixels — or null
 * for an already-square image, where there is nothing to choose. */
export function cropRect(source: SourceSize, offset: number): CoverCrop | null {
  const { width, height } = source;
  if (width === height) return null;
  const size = Math.min(width, height);
  const play = Math.max(width, height) - size;
  const shift = Math.round(clampOffset(offset) * play);
  return width > height ? { left: shift, top: 0, size } : { left: 0, top: shift, size };
}

export function clampOffset(offset: number): number {
  return Math.min(1, Math.max(0, offset));
}

/** How far the preview image must slide (as a fraction of its long side) so
 * the crop window shows the chosen square. */
export function previewShift(source: SourceSize, offset: number): number {
  const { width, height } = source;
  const long = Math.max(width, height);
  if (long === 0) return 0;
  const play = long - Math.min(width, height);
  return (clampOffset(offset) * play) / long;
}
