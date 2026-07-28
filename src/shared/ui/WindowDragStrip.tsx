import { isMacOS } from "@/shared/lib/platform";

/**
 * The band you grab to move the window.
 *
 * macOS only, and it exists because of what we asked for: `titleBarStyle:
 * "Overlay"` buys the app the whole window, title bar included, and the price is
 * that nothing up there moves the window any more. The sidebar's header was the
 * one place that did, which meant a window could only be dragged by its
 * top-left corner.
 *
 * Three details make it work rather than get in the way:
 *
 * - It is `absolute` inside the *scrolling* content, not fixed over it. Scroll
 *   down and it leaves with the page, so it never sits invisibly on top of a
 *   row you are trying to click.
 * - It is 2rem tall — the page's own top padding. Every hero starts at 1.25rem,
 *   so the one control that reaches into the band is the breadcrumb, which
 *   claims the same z-index later in the tree and wins.
 * - The attribute is bare, not `deep`: only presses landing on this element
 *   drag, so nothing underneath is affected even where it overlaps.
 *
 * Requires `core:window:allow-start-dragging` — `core:window:default` does not
 * include it, and without it the drag region silently does nothing.
 */
export function WindowDragStrip() {
  if (!isMacOS) return null;

  return <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-8" />;
}
