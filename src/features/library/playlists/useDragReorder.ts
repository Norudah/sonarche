import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { rowShift, targetIndex } from "@/features/library/playlists/reorder";
import { edgeScrollSpeed } from "@/shared/lib/edgeScroll";
import { useScrollport } from "@/shared/ui/Scrollport";

/** The table's `border-spacing-y-0.5`; row height is measured at drag start. */
const ROW_GAP = 2;

interface DragState {
  from: number;
  to: number;
  /** Pointer plus auto-scroll offset. */
  deltaY: number;
  /** Measured at grab time. */
  rowHeight: number;
}

interface DragReorder {
  drag: DragState | null;
  handleProps: (index: number) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  rowStyle: (index: number) => CSSProperties | undefined;
}

/**
 * Pointer-capture row reordering. HTML5 drag-and-drop was ruled out: no
 * auto-scroll in WKWebView, an unstyleable ghost, a hijacked cursor. Rows
 * preview the order with transforms; the gesture's state lives in the
 * pointerdown closure. Auto-scroll runs on its own frame loop.
 *
 * Known limit: on a windowed list, a long auto-scroll can unmount the dragged
 * row until the drop; the result stays correct (state is index-based).
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void): DragReorder {
  const scrollport = useScrollport();
  const [drag, setDrag] = useState<DragState | null>(null);

  const handleProps = (index: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || count < 2) return;
      const handle = event.currentTarget;
      const row = handle.closest("tr");
      if (!row) return;

      event.preventDefault();
      handle.setPointerCapture(event.pointerId);

      const startY = event.clientY;
      const startScrollTop = scrollport.current?.scrollTop ?? 0;
      const rowHeight = row.getBoundingClientRect().height + ROW_GAP;
      let lastClientY = startY;
      let scrollFrame: number | null = null;
      // Read outside setDrag: a side effect in an updater runs twice under StrictMode.
      let current: DragState = { from: index, to: index, deltaY: 0, rowHeight };

      const applyPointer = () => {
        const scrolled = (scrollport.current?.scrollTop ?? startScrollTop) - startScrollTop;
        const deltaY = lastClientY - startY + scrolled;
        current = { from: index, to: targetIndex(index, deltaY, rowHeight, count), deltaY, rowHeight };
        setDrag(current);
      };

      const autoScrollTick = () => {
        scrollFrame = null;
        const port = scrollport.current;
        if (!port) return;
        const rect = port.getBoundingClientRect();
        const speed = edgeScrollSpeed(lastClientY, rect.top, rect.bottom);
        if (speed !== 0) {
          const before = port.scrollTop;
          port.scrollTop += speed;
          if (port.scrollTop !== before) applyPointer();
          scrollFrame = requestAnimationFrame(autoScrollTick);
        }
      };

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        lastClientY = moveEvent.clientY;
        applyPointer();
        if (scrollFrame == null) scrollFrame = requestAnimationFrame(autoScrollTick);
      };
      const finish = (commit: boolean) => {
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        if (scrollFrame != null) cancelAnimationFrame(scrollFrame);
        setDrag(null);
        if (commit && current.to !== current.from) onMove(current.from, current.to);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      // On the capturing handle, so they end with the gesture.
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);

      setDrag(current);
    },
  });

  const rowStyle = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) {
      return { transform: `translateY(${drag.deltaY}px)`, position: "relative", zIndex: 10 };
    }
    const shift = rowShift(index, drag.from, drag.to, drag.rowHeight);
    return { transform: `translateY(${shift}px)`, transition: "transform 150ms ease" };
  };

  return { drag, handleProps, rowStyle };
}
