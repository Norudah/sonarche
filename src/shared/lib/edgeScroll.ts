/** Signed auto-scroll speed (px/frame) for a pointer at `clientY` in a
 * scrollport spanning [top, bottom]: zero outside the edge zones, ramping up
 * inside them. Shared by every pointer-drag gesture. */
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
