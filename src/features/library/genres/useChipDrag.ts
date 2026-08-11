import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { canDropOn } from "@/features/library/genres/arrange";
import { edgeScrollSpeed } from "@/shared/lib/edgeScroll";
import { useScrollport } from "@/shared/ui/Scrollport";

/** Cards declare themselves targets with this attribute; the hit test walks up
 * from whatever the pointer is over. The floating chip never intercepts — it
 * is `pointer-events: none`. */
export const DROP_ATTR = "data-drop-family";

interface ChipDrag {
  genre: string;
  /** Family key of the card the chip came from. */
  from: string;
  /** Card under the pointer that would take the drop, or null. */
  over: string | null;
  /** Pointer position as of the last *render-worthy* change. Between renders
   * the position is written straight to the floating chip — but a re-render
   * re-applies the style prop, so the state must carry the latest position it
   * knew, or the chip would snap back to where the gesture began. */
  x: number;
  y: number;
}

interface ChipDragApi {
  /** Live while a chip is held; null the rest of the time. */
  drag: ChipDrag | null;
  /** Ref for the floating chip the view renders while a drag is live. */
  ghostRef: RefObject<HTMLDivElement | null>;
  /** Spread onto each draggable chip. */
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
 * Pointer-driven chip-to-card dragging, the `useDragReorder` school: no HTML5
 * DnD (unstylable ghost screenshot, engine-dependent auto-scroll — see that
 * hook for the full case), the chip captures the pointer and the whole gesture
 * lives inside the pointerdown closure, so releasing the pointer releases
 * everything.
 *
 * Two deliberate differences from the reorder hook. The floating chip follows
 * the pointer via direct style writes rather than state — this page re-renders
 * a whole card grid, and a render per pointermove is exactly the jank the
 * compositor was meant to absorb. State only changes when the card under the
 * pointer changes, which is when something actually needs repainting. And the
 * target is found by hit-testing (`elementFromPoint` + the drop attribute),
 * not geometry: the cards are a wrapping two-column grid whose rects auto-
 * scroll moves mid-gesture, so asking the DOM beats mirroring its layout.
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
      // The gesture's own copy — the drop must read it outside setDrag (a side
      // effect inside a state updater runs twice under StrictMode).
      let current: ChipDrag = { genre, from, over: null, x: lastX, y: lastY };
      setDrag(current);

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

      // Same shape as the reorder hook: its own frame loop, because pointer
      // events stop the moment the hand does, while the page should keep
      // scrolling as long as the pointer sits in an edge zone.
      const autoScrollTick = () => {
        scrollFrame = null;
        const port = scrollport.current;
        if (!port) return;
        const rect = port.getBoundingClientRect();
        const speed = edgeScrollSpeed(lastY, rect.top, rect.bottom);
        if (speed !== 0) {
          const before = port.scrollTop;
          port.scrollTop += speed;
          // The cards moved under a still pointer; the hit test must rerun.
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
