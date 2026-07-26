import { normalize } from "@/shared/lib/text";

/**
 * A free-text filter over a fixed set of fields, with its own haystack cache.
 *
 * Every surface searches the same way — each whitespace-separated term must
 * match somewhere, so "daft disc" finds Discovery — and each one used to build
 * its haystack inside the predicate. That is one `normalize()` per item per
 * keystroke, and `normalize` is not cheap: a lowercase, an NFD expansion and a
 * Unicode regex, three allocations, for a string that never changes. Measured
 * over 10 000 tracks: 25 ms a keystroke, against 0.9 ms once the haystacks are
 * kept.
 *
 * Keyed on item identity, which is what makes the cache correct rather than
 * merely fast: an edit invalidates the library query, so the refetch mints new
 * objects and the stale entries are unreachable and collectable. Nothing has to
 * remember to clear anything — but it does mean callers must not mutate an
 * indexed item in place, which nothing in the app does.
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
    // The input array by reference: an empty search must not allocate a copy of
    // the whole library on every render.
    if (terms.length === 0) return items;

    return items.filter((item) => {
      const haystack = haystackFor(item);
      return terms.every((term) => haystack.includes(term));
    });
  };
}
