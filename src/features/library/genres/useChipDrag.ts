import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { canDropOn } from "@/features/library/genres/arrange";
import { edgeScrollSpeed } from "@/shared/lib/edgeScroll";
import { useScrollport } from "@/shared/ui/Scrollport";

/** Marks drop targets; hit-testing walks up from the pointer. The floating
 * chip is `pointer-events: none`. */
export const DROP_ATTR = "data-drop-family";

interface ChipDrag {
  genre: string;
  /** The source card's family. */
  from: string;
  /** The card that would take the drop. */
  over: string | null;
  /** Last position known at a render. Between renders the chip is moved by
   * direct style writes; this keeps a re-render from snapping it back. */
  x: number;
  y: number;
}

interface ChipDragApi {
  drag: ChipDrag | null;
  /** The floating chip the view renders during a drag. */
  ghostRef: RefObject<HTMLDivElement | null>;
  chipProps: (
    genre: string,
    from: string,
  ) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
}

function dropKeyAt(x: number, y: number): string | null {
  const hit = document.elementFromPoint(x, y)?.closest(`[${DROP_ATTR}]`);
  return hit?.getAttribute(DROP_ATTR) ?? null;
}

/**
 * Chip-to-card dragging with pointer capture, like `useDragReorder`. The
 * floating chip moves by direct style writes (no render per pointermove);
 * state changes only when the target card changes. Targets are found by
 * hit-testing, since auto-scroll moves the wrapping grid mid-gesture.
 */
export function useChipDrag(onDrop: (genre: string, family: string, from: string) => void): ChipDragApi {
  const scrollport = useScrollport();
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<ChipDrag | null>(null);

  const chipProps = (genre: string, from: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const chip = event.currentTarget;
      event.preventDefault();
      chip.setPointerCapture(event.pointerId);

      let lastX = event.clientX;
      let lastY = event.clientY;
      let scrollFrame: number | null = null;
      // Read outside setDrag: updaters run twice under StrictMode.
      let current: ChipDrag = { genre, from, over: null, x: lastX, y: lastY };
      setDrag(current);

      // Under pointer capture the cursor follows the hovered element; hold it.
      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = "grabbing";

      const moveGhost = () => {
        const ghost = ghostRef.current;
        if (ghost) ghost.style.transform = `translate(${lastX}px, ${lastY}px)`;
      };

      const applyPointer = () => {
        moveGhost();
        const key = dropKeyAt(lastX, lastY);
        const over = key != null && canDropOn(key, from) ? key : null;
        if (over !== current.over) {
          current = { ...current, over, x: lastX, y: lastY };
          setDrag(current);
        }
      };

      // Its own frame loop: pointer events stop when the hand does.
      const autoScrollTick = () => {
        scrollFrame = null;
        const port = scrollport.current;
        if (!port) return;
        const rect = port.getBoundingClientRect();
        const speed = edgeScrollSpeed(lastY, rect.top, rect.bottom);
        if (speed !== 0) {
          const before = port.scrollTop;
          port.scrollTop += speed;
          // The cards moved under a still pointer: re-run the hit test.
          if (port.scrollTop !== before) applyPointer();
          scrollFrame = requestAnimationFrame(autoScrollTick);
        }
      };

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        lastX = moveEvent.clientX;
        lastY = moveEvent.clientY;
        applyPointer();
        if (scrollFrame == null) scrollFrame = requestAnimationFrame(autoScrollTick);
      };
      const finish = (commit: boolean) => {
        chip.removeEventListener("pointermove", onPointerMove);
        chip.removeEventListener("pointerup", onUp);
        chip.removeEventListener("pointercancel", onCancel);
        if (scrollFrame != null) cancelAnimationFrame(scrollFrame);
        document.body.style.cursor = previousCursor;
        setDrag(null);
        if (commit && current.over != null) onDrop(current.genre, current.over, current.from);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      chip.addEventListener("pointermove", onPointerMove);
      chip.addEventListener("pointerup", onUp);
      chip.addEventListener("pointercancel", onCancel);
    },
  });

  return { drag, ghostRef, chipProps };
}
