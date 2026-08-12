/** Signed auto-scroll speed (px/frame) for a pointer at `clientY` inside a
 * scrollport spanning [top, bottom]. Zero outside the edge zones; ramps up as
 * the pointer digs into them, so the scroll answers intent rather than lurching
 * the moment the pointer crosses a line.
 *
 * Shared by every pointer-drag gesture (playlist row reorder, genre chip
 * drops): each runs its own animation-frame loop with this as the law of
 * motion, so the page scrolls the same way whatever is being dragged. */
export function edgeScrollSpeed(clientY: number, top: number, bottom: number, zone = 56, max = 14): number {
  if (clientY < top + zone) {
    const depth = Math.min(1, (top + zone - clientY) / zone);
    return -Math.ceil(depth * max);
  }
  if (clientY > bottom - zone) {
    const depth = Math.min(1, (clientY - (bottom - zone)) / zone);
    return Math.ceil(depth * max);
  }
  return 0;
}
