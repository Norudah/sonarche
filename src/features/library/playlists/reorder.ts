/**
 * The arithmetic behind dragging a playlist row — kept pure so the geometry
 * can be tested without a pointer. The DOM half lives in `useDragReorder`.
 *
 * The model: rows are uniform in height. The dragged row follows the pointer;
 * every row between its origin and its target shifts one row height the other
 * way, so the list previews the final order without any DOM reordering.
 */

/** Where the dragged row would land, given how far the pointer travelled. */
export function targetIndex(from: number, deltaY: number, rowHeight: number, count: number): number {
  if (count === 0 || rowHeight <= 0) return from;
  const moved = Math.round(deltaY / rowHeight);
  return Math.min(Math.max(from + moved, 0), count - 1);
}

/** The vertical shift (px) a non-dragged row takes on while a drag from
 * `from` hovers over `to`. Zero for rows outside the affected span. */
export function rowShift(index: number, from: number, to: number, rowHeight: number): number {
  if (from < to && index > from && index <= to) return -rowHeight;
  if (from > to && index >= to && index < from) return rowHeight;
  return 0;
}

/** The list as it will read after the drop. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
