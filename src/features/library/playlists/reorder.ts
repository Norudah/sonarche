/** Pure drag-reorder arithmetic for uniform rows (DOM half: `useDragReorder`). */

export function targetIndex(from: number, deltaY: number, rowHeight: number, count: number): number {
  if (count === 0 || rowHeight <= 0) return from;
  const moved = Math.round(deltaY / rowHeight);
  return Math.min(Math.max(from + moved, 0), count - 1);
}

/** Shift (px) of a non-dragged row while a drag from `from` hovers `to`. */
export function rowShift(index: number, from: number, to: number, rowHeight: number): number {
  if (from < to && index > from && index <= to) return -rowHeight;
  if (from > to && index >= to && index < from) return rowHeight;
  return 0;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
