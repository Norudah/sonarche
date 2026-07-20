import type { Preferences, RateLimitKey } from "@/features/settings/api";

/** Bounds mirror `preferences.rs`; the backend clamps anyway, this is UX. */
export interface RateLimitDef {
  key: RateLimitKey;
  field: keyof Preferences;
  min: number;
  max: number;
  step: number;
  /** Spacing of the printed scale under the track — coarser than `step` when
   * the range would otherwise print an unreadable row of numbers. */
  markStep: number;
  /** Below this, the slider shows the "you're being rude" warning. */
  politeThreshold: number;
  /** Round reference batch used for the duration estimate line. */
  sampleCount: number;
}

export const RATE_LIMITS: RateLimitDef[] = [
  {
    key: "download",
    field: "downloadDelaySeconds",
    min: 0,
    max: 15,
    step: 1,
    markStep: 3,
    politeThreshold: 3,
    sampleCount: 15,
  },
  {
    key: "acoustid",
    field: "acoustidLookupDelaySeconds",
    min: 0,
    max: 2,
    step: 0.25,
    markStep: 0.5,
    politeThreshold: 0.34,
    sampleCount: 15,
  },
  {
    key: "lastfm",
    field: "lastfmFetchDelaySeconds",
    min: 0,
    max: 1.5,
    step: 0.25,
    markStep: 0.25,
    politeThreshold: 1,
    sampleCount: 100,
  },
];

export function marksFor({ min, max, markStep }: RateLimitDef): number[] {
  return Array.from({ length: Math.round((max - min) / markStep) + 1 }, (_, i) => min + i * markStep);
}

export function formatDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return seconds === 0 ? `${minutes}min` : `${minutes}min ${seconds}s`;
}
