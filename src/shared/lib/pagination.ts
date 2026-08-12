/**
 * Where a requested page actually lands over a list of `itemCount` items.
 *
 * Clamped rather than trusted: a history cleared from under page 4 resolves to
 * the last page that still exists, and an empty list still has one page so the
 * view never divides by zero. `start` is the offset of the page's first item —
 * what a slice or a SQL OFFSET consumes.
 */
export function pageWindow(
  requested: number,
  itemCount: number,
  size: number,
): { page: number; pageCount: number; start: number } {
  const pageCount = Math.max(1, Math.ceil(itemCount / size));
  const page = Math.min(Math.max(1, Math.floor(requested)), pageCount);
  return { page, pageCount, start: (page - 1) * size };
}
