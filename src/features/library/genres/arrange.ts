import {
  FAMILY_KEYS,
  FAMILY_NONE,
  FAMILY_OTHER,
  isFamilyRootGenre,
  type Family,
} from "@/features/library/genres/genres";

/**
 * The pure half of the Genres arrange mode — which cards appear, what can be
 * picked up, where it may land. The pointer half lives in `useChipDrag`.
 */

/** Families with no card on the shelf. Ordinarily invisible (a family with no
 * tracks has nothing to show), which is exactly why arrange mode must conjure
 * them: a genre cannot be dragged to a shelf that is not there. */
export function ghostFamilies(families: Family[]): string[] {
  const present = new Set(families.map((family) => family.key));
  return FAMILY_KEYS.filter((key) => !present.has(key));
}

/** A chip can be picked up unless the genre *is* a family root — the sidecar
 * refuses to move those (same guard as the classify menu). */
export function canDragGenre(name: string): boolean {
  return !isFamilyRootGenre(name);
}

/**
 * Whether a card accepts the drag in flight. Its own family is a no-op, not a
 * move; the sentinels take nothing — `Other` is not a place one files *to*
 * (that is "original placement", a decision, not a destination) and `None`
 * means the absence of a genre.
 */
export function canDropOn(familyKey: string, fromKey: string): boolean {
  if (familyKey === fromKey) return false;
  if (familyKey === FAMILY_OTHER || familyKey === FAMILY_NONE) return false;
  return (FAMILY_KEYS as readonly string[]).includes(familyKey);
}
