/** Clamps a requested page to `itemCount` (an empty list still has one page).
 * `start` is the offset of the page's first item. */
export function pageWindow(
  requested: number,
  itemCount: number,
  size: number,
): { page: number; pageCount: number; start: number } {
  const pageCount = Math.max(1, Math.ceil(itemCount / size));
  const page = Math.min(Math.max(1, Math.floor(requested)), pageCount);
  return { page, pageCount, start: (page - 1) * size };
}
