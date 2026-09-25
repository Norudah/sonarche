import type { Preferences, RateLimitKey } from "@/features/settings/api";

/** Numeric preference fields only (`audioFormat` is a string). */
type DelayField = {
  [K in keyof Preferences]: Preferences[K] extends number ? K : never;
}[keyof Preferences];

/**
 * A delay and its slider scale: quarter seconds up to two, whole seconds
 * after, evenly spaced along the track. Bounds mirror `preferences.rs`
 * (the backend clamps anyway).
 */
export interface RateLimitDef {
  key: RateLimitKey;
  field: DelayField;
  max: number;
  /** Below this, the slider warns. */
  politeThreshold: number;
  /** Batch size for the duration estimate. */
  sampleCount: number;
  /** Strings live under this base in the `settings` namespace. */
  labelBase: string;
}

const POLITE_FLOOR = 1;

/** Only the download delay is tunable. */
export const RATE_LIMITS: RateLimitDef[] = [
  {
    key: "download",
    field: "downloadDelaySeconds",
    max: 15,
    politeThreshold: POLITE_FLOOR,
    sampleCount: 15,
    labelBase: "adding.delay",
  },
];

/** Read from preferences (reset to defaults by the backend on load). */
export const FIXED_API_DELAYS: { key: "acoustid" | "lastfm"; field: DelayField }[] = [
  { key: "acoustid", field: "acoustidLookupDelaySeconds" },
  { key: "lastfm", field: "lastfmFetchDelaySeconds" },
];

const FINE_UNTIL = 2;
const FINE_STEP = 0.25;

/** Every slider value from 0 to `max`. Rounded to avoid float drift
 * (8 × 0.25 = 1.9999999999999998). */
export function stopsFor(max: number): number[] {
  const stops: number[] = [];
  for (let value = 0; value <= Math.min(max, FINE_UNTIL) + 1e-9; value += FINE_STEP) {
    stops.push(Math.round(value * 100) / 100);
  }
  for (let value = FINE_UNTIL + 1; value <= max + 1e-9; value += 1) {
    stops.push(value);
  }
  if (stops[stops.length - 1] !== max) stops.push(max);
  return stops;
}

/** Snaps a stored value to the closest stop. */
export function nearestStopIndex(stops: number[], seconds: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i] - seconds) < Math.abs(stops[best] - seconds)) best = i;
  }
  return best;
}

export interface DelayMark {
  value: number;
  /** Percent along the track, by stop index. */
  position: number;
}

/** The labelled values: ends, polite floor, the 2 s hinge, round numbers after. */
export function marksFor(max: number): DelayMark[] {
  const stops = stopsFor(max);
  const wanted = [0, 1, 2, 5, 10, 15].filter((value) => value <= max);
  if (!wanted.includes(max)) wanted.push(max);

  return wanted.map((value) => ({
    value,
    position: (nearestStopIndex(stops, value) / (stops.length - 1)) * 100,
  }));
}

/** `0` prints as a word ("instant"). */
export function formatDelay(seconds: number, locale: string, instantLabel: string): string {
  if (seconds === 0) return instantLabel;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(seconds)} s`;
}

export function formatDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return seconds === 0 ? `${minutes}min` : `${minutes}min ${seconds}s`;
}
