import { FAMILY_NONE, FAMILY_OTHER, type Family } from "@/features/library/genres/genres";

const OTHER_TONE = "color-mix(in oklab, var(--color-muted) 40%, transparent)";

/**
 * One colour per family, as ready-to-use CSS colours.
 *
 * A colour identifies a family and nothing else. The family list, the genre
 * list and the detail hero all read from this one map, so "that shade of
 * indigo" means the same family wherever it appears — a genre simply inherits
 * its family's colour. In the genre list that is what makes a flat list of
 * twenty-seven names still read as grouped, without repeating a family label on
 * every row.
 *
 * The shades themselves are one hue ramped by rank. A palette of thirteen
 * tinted families would look richer and encode nothing — "Pop is violet" is not
 * a fact — whereas the ramp doubles as the ranking. Mixing towards
 * `transparent` rather than towards white is what keeps it a token: it reads as
 * "less" on the light ground and on the dark one, instead of inverting the
 * moment the theme flips.
 *
 * Two families step out of the ramp and both earn it: `Other` is grey because
 * it is a leftover bucket rather than a small family, and `None` is the app's
 * amber — the colour that already means "metadata missing" everywhere else.
 *
 * Build this from the *whole* family list, never from a filtered one: a colour
 * that shifts when the user types is not an identity.
 */
export function familyTones(families: Family[]): Map<string, string> {
  const ramp = families.filter(
    (family) => family.key !== FAMILY_NONE && family.key !== FAMILY_OTHER,
  );

  // Floored at 55%, not lower. The first cut of this ramp bottomed out at 30%
  // and on a library with three real families it inverted the page's meaning:
  // the last family came out paler than the grey `Other` bucket sitting right
  // under it, so a genre the user actually listens to read as *less* than the
  // leftovers. The ramp only has to say "bigger / smaller" — the list order
  // already carries the exact ranking — so it does not need the full range.
  const steps = Math.max(ramp.length - 1, 1);

  const tones = new Map<string, string>(
    ramp.map((family, rank) => [
      family.key,
      `color-mix(in oklab, var(--color-accent) ${100 - (rank / steps) * 45}%, transparent)`,
    ]),
  );
  tones.set(FAMILY_OTHER, OTHER_TONE);
  tones.set(FAMILY_NONE, "var(--color-warning)");
  return tones;
}

export function toneOf(tones: Map<string, string>, family: string): string {
  return tones.get(family) ?? OTHER_TONE;
}
