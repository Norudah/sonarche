import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { edgeScrollSpeed, rowShift, targetIndex } from "@/features/library/playlists/reorder";
import { useScrollport } from "@/shared/ui/Scrollport";

/** Vertical distance between two row tops beyond the row itself: the table's
 * `border-spacing-y-0.5` (2px). The row height is measured from the grabbed
 * row at drag start — a constant would silently lie the day padding changes. */
const ROW_GAP = 2;

interface DragState {
  from: number;
  /** Where the row would land if released now. */
  to: number;
  /** How far the dragged row is from its slot, pointer + auto-scroll combined. */
  deltaY: number;
  /** Row pitch measured at grab time; rowStyle needs it to shift neighbours. */
  rowHeight: number;
}

interface DragReorder {
  /** Live while a handle is held; null the rest of the time. */
  drag: DragState | null;
  /** Spread onto each row's drag handle. */
  handleProps: (index: number) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** The transform each row wears while a drag is live. */
  rowStyle: (index: number) => CSSProperties | undefined;
}

/**
 * Pointer-driven row reordering, no drag-and-drop API and no dependency.
 *
 * HTML5 DnD was the obvious reach and the wrong one: its auto-scroll is
 * engine-dependent (WKWebView does nothing), its ghost image is a screenshot
 * we cannot style, and it commandeers the cursor. Pointer capture gives the
 * same gesture with none of that — the handle captures the pointer, the maths
 * lives in `reorder.ts`, and rows preview the final order with transforms
 * (compositor work, no relayout, no DOM reordering until the store answers).
 *
 * The whole gesture lives inside the pointerdown closure: geometry, listeners
 * and the auto-scroll frame are locals that exist exactly as long as the drag,
 * so there is nothing to desynchronise from render and nothing to clean up on
 * unmount — releasing the pointer releases it all.
 *
 * Auto-scroll runs on its own animation frame loop so holding the pointer
 * still inside an edge zone keeps scrolling — pointer events stop firing the
 * moment the hand stops. The loop folds the scrolled distance back into the
 * drag's delta, so the row stays under the pointer while the page moves.
 *
 * One known limit, accepted: on a *windowed* list (150+ rows), a very long
 * auto-scroll can carry the window past the dragged row's own slot, at which
 * point its ghost unmounts until the drop. The order preview and the drop
 * itself stay correct — state is index-based, not DOM-based.
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
      // The gesture's own copy of the state. `finish` must read the final
      // position *outside* setDrag — a side effect inside a state updater runs
      // twice under StrictMode, and this one is a store write.
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

      // Listeners on the capturing handle, so they follow the pointer wherever
      // it goes and vanish with the gesture — nothing global to forget.
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
