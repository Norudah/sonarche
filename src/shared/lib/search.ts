import { normalize } from "@/shared/lib/text";

/**
 * A free-text filter over fixed fields: every whitespace-separated term must
 * match somewhere. Normalized haystacks are cached per item (25 ms → 0.9 ms
 * per keystroke on 10 000 tracks). Keyed on object identity, so items must
 * not be mutated in place; refetches create new objects.
 */
export function createTextFilter<T extends object>(
  haystackOf: (item: T) => string,
): (items: T[], query: string) => T[] {
  const cache = new WeakMap<T, string>();

  const haystackFor = (item: T): string => {
    const cached = cache.get(item);
    if (cached !== undefined) return cached;

    const built = normalize(haystackOf(item));
    cache.set(item, built);
    return built;
  };

  return (items, query) => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    // Same reference: no copy of the whole library per render.
    if (terms.length === 0) return items;

    return items.filter((item) => {
      const haystack = haystackFor(item);
      return terms.every((term) => haystack.includes(term));
    });
  };
}
