import { FAMILY_NONE, FAMILY_OTHER, type Family } from "@/features/library/genres/genres";

/**
 * The colour of a family, as a ready-to-use CSS colour.
 *
 * One hue for the whole page, rank-ramped: the biggest family is the full
 * accent and each one below it is mixed further towards transparent. A palette
 * of thirteen tinted pastels would look richer and mean nothing — "Pop is
 * violet" encodes no fact — whereas the ramp *is* the ranking, which is the one
 * thing the page is about.
 *
 * Mixing towards `transparent` rather than towards white is what keeps it a
 * token: it reads as "less" on the light ground and on the dark one, instead of
 * inverting into "more" the moment the theme flips.
 *
 * Two families step out of the ramp, and both earn it: `Other` is grey because
 * it is a leftover bucket, not a small family, and `None` is the app's amber —
 * the colour that already means "metadata missing" everywhere else.
 */
export function familyTone(key: string, rank: number, rampSize: number): string {
  if (key === FAMILY_NONE) return "var(--color-warning)";
  if (key === FAMILY_OTHER) return "color-mix(in oklab, var(--color-muted) 40%, transparent)";

  // Floored at 55%, not lower. The first cut of this ramp bottomed out at 30%
  // and on a library with three real families it inverted the page's meaning:
  // the last family came out paler than the grey `Other` bucket sitting right
  // under it, so a genre the user actually listens to read as *less* than the
  // leftovers. The ramp only has to say "bigger / smaller" — the list order
  // already carries the exact ranking — so it does not need the full range.
  const steps = Math.max(rampSize - 1, 1);
  const strength = 100 - (Math.min(rank, steps) / steps) * 45;
  return `color-mix(in oklab, var(--color-accent) ${strength}%, transparent)`;
}

/** How many families take part in the ramp — the sentinels have fixed colours
 * and must not stretch it. */
export function rampSizeOf(families: Family[]): number {
  return families.filter((family) => family.key !== FAMILY_NONE && family.key !== FAMILY_OTHER)
    .length;
}
