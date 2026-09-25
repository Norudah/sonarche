import { isMacOS } from "@/shared/lib/platform";

/**
 * macOS window drag band for screens without the topbar (onboarding).
 * Absolute inside the scrolling content, and `data-tauri-drag-region` is bare
 * so only presses on this element drag. Needs
 * `core:window:allow-start-dragging`.
 */
export function WindowDragStrip() {
  if (!isMacOS) return null;

  return <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-8" />;
}
