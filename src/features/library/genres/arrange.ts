import {
  FAMILY_KEYS,
  FAMILY_NONE,
  FAMILY_OTHER,
  isFamilyRootGenre,
  type Family,
} from "@/features/library/genres/genres";

/** Pure half of the Genres arrange mode; the pointer half is `useChipDrag`. */

/** Families with no card; arrange mode shows them as drop targets. */
export function ghostFamilies(families: Family[]): string[] {
  const present = new Set(families.map((family) => family.key));
  return FAMILY_KEYS.filter((key) => !present.has(key));
}

/** Family roots can't be moved (the sidecar refuses). */
export function canDragGenre(name: string): boolean {
  return !isFamilyRootGenre(name);
}

/** Not its own family (a no-op), nor the sentinels (`Other` isn't a
 * destination, `None` means no genre). */
export function canDropOn(familyKey: string, fromKey: string): boolean {
  if (familyKey === fromKey) return false;
  if (familyKey === FAMILY_OTHER || familyKey === FAMILY_NONE) return false;
  return (FAMILY_KEYS as readonly string[]).includes(familyKey);
}
