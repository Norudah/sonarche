import type { Preferences, RateLimitKey } from "@/features/settings/api";

/**
 * The politeness delays, and the scale their sliders run on.
 *
 * The scale is a list of stops rather than a `min/max/step` triple, because the
 * interesting part of every one of these ranges is its first two seconds and a
 * uniform step cannot serve both ends. At one-second steps there was nothing
 * between "instant" and "one second" — the whole region where a delay actually
 * changes behaviour — and at quarter-second steps a fifteen-second download
 * delay would have sixty of them.
 *
 * So: quarter seconds up to two, whole seconds after. Stops are evenly spaced
 * along the track, which spends most of the rail on the part worth aiming at.
 * The printed scale is positioned from the stop indexes for the same reason —
 * a `justify-between` row of numbers would claim a linear track that is not.
 *
 * Bounds mirror `preferences.rs`; the backend clamps anyway, this is UX.
 */
export interface RateLimitDef {
  key: RateLimitKey;
  field: keyof Preferences;
  max: number;
  /** Below this, the slider shows the "you are being rude" warning. One second
   * for all three: it is the floor the app asks users to stay above, whatever
   * the service's own documented limit happens to be. */
  politeThreshold: number;
  /** Round reference batch used for the duration estimate line. */
  sampleCount: number;
}

const POLITE_FLOOR = 1;

export const RATE_LIMITS: RateLimitDef[] = [
  { key: "download", field: "downloadDelaySeconds", max: 15, politeThreshold: POLITE_FLOOR, sampleCount: 15 },
  { key: "acoustid", field: "acoustidLookupDelaySeconds", max: 2, politeThreshold: POLITE_FLOOR, sampleCount: 15 },
  { key: "lastfm", field: "lastfmFetchDelaySeconds", max: 1.5, politeThreshold: POLITE_FLOOR, sampleCount: 100 },
];

/** Where the fine grain stops and whole seconds take over. */
const FINE_UNTIL = 2;
const FINE_STEP = 0.25;

/**
 * Every value the slider can land on, ascending, always starting at 0 and
 * ending at `max`.
 *
 * Rounded on the way out: 0.25 accumulated eight times in binary floating point
 * lands on 1.9999999999999998, which would then never compare equal to a stored
 * 2 and would print as `2,00` only by luck of the formatter.
 */
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

/**
 * The stop a stored value sits on. Anything between two stops — a value saved
 * by an older build, or clamped by the backend — snaps to the closest rather
 * than being refused, so the slider always has a position to show.
 */
export function nearestStopIndex(stops: number[], seconds: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i] - seconds) < Math.abs(stops[best] - seconds)) best = i;
  }
  return best;
}

export interface DelayMark {
  value: number;
  /** Percent along the track, derived from the stop index — the track is linear
   * in stops, not in seconds. */
  position: number;
}

/**
 * The handful of values worth printing under the track: the two ends, the
 * polite floor, the two-second hinge, and round numbers past it. Enough to read
 * the scale, few enough not to become a ruler.
 */
export function marksFor(max: number): DelayMark[] {
  const stops = stopsFor(max);
  const wanted = [0, 1, 2, 5, 10, 15].filter((value) => value <= max);
  if (!wanted.includes(max)) wanted.push(max);

  return wanted.map((value) => ({
    value,
    position: (nearestStopIndex(stops, value) / (stops.length - 1)) * 100,
  }));
}

/** `0` is a word, not a number — "instant" is what turning the delay off means,
 * and printing `0 s` invites reading it as a very short pause. */
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
