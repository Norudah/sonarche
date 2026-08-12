import { Slider } from "@heroui/react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  clamp01,
  clampZoom,
  frameFits,
  MAX_ZOOM,
  MIN_ZOOM,
  stageLayout,
  type CropFrame,
  type SourceSize,
} from "@/features/library/covers/coverCrop";

/** One notch of the zoom slider, and one arrow press on the frame. */
const ZOOM_STEP = 0.02;

/**
 * The crop, chosen by moving the frame itself and by sizing it.
 *
 * The whole image is shown, the square window sits over it, and everything
 * outside the window is washed out — what stays bright is exactly what the
 * cover will be. Dragging moves whichever of the two can move (see
 * `stageLayout`); the wheel and the slider below size the window.
 *
 * Sized past the largest square the picture holds, the frame leaves the
 * picture: the wash then shows through where there is nothing to crop, and the
 * ring turns amber. The stage does not refuse to go there — a control that
 * silently stops is a control that explains nothing — it just stops being
 * something the caller can confirm.
 */
export function CropStage({
  url,
  natural,
  frame,
  maxPx,
  label,
  zoomLabel,
  round = false,
  onFrame,
}: {
  url: string;
  natural: SourceSize;
  frame: CropFrame;
  /** Stage ceiling, CSS px — the long side fits this. */
  maxPx: number;
  /** Accessible name for the frame. */
  label: string;
  /** Accessible name for the zoom slider. */
  zoomLabel: string;
  /** Circular window instead of a square one — for images worn as a disc
   * (artists). What is written stays the square; the circle previews the mask
   * the interface will draw it under, corners honestly washed out. */
  round?: boolean;
  onFrame: (frame: CropFrame) => void;
}) {
  const stage = stageLayout(natural, frame, maxPx);
  const fits = frameFits(natural, frame.zoom);
  const drag = useRef<{ pointerId: number; x: number; y: number; frame: CropFrame } | null>(null);

  const move = (over: Partial<CropFrame>) => onFrame({ ...frame, ...over });

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stage.travelX === 0 && stage.travelY === 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, frame };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || held.pointerId !== event.pointerId) return;
    move({
      x: stage.travelX > 0 ? clamp01(held.frame.x + (event.clientX - held.x) / stage.travelX) : held.frame.x,
      y: stage.travelY > 0 ? clamp01(held.frame.y + (event.clientY - held.y) / stage.travelY) : held.frame.y,
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.05;
    const moves: Record<string, Partial<CropFrame>> = {
      ArrowRight: { x: clamp01(frame.x + step) },
      ArrowLeft: { x: clamp01(frame.x - step) },
      ArrowDown: { y: clamp01(frame.y + step) },
      ArrowUp: { y: clamp01(frame.y - step) },
      "+": { zoom: clampZoom(frame.zoom - ZOOM_STEP) },
      "-": { zoom: clampZoom(frame.zoom + ZOOM_STEP) },
    };
    const next = moves[event.key];
    if (next) {
      event.preventDefault();
      move(next);
    }
  };

  // Subscribed by hand rather than through `onWheel`: React attaches that one
  // passively, so `preventDefault` is refused and zooming would scroll the
  // modal behind the stage at the same time.
  const boxRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<(delta: number) => void>(() => {});
  wheelRef.current = (delta) => move({ zoom: clampZoom(frame.zoom + delta * 0.0015) });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelRef.current(event.deltaY);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  const canDrag = stage.travelX > 0 || stage.travelY > 0;

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: maxPx }}>
      <div
        ref={boxRef}
        className="relative touch-none overflow-hidden rounded-xl bg-surface-secondary ring-1 ring-artwork-edge select-none"
        style={{ width: stage.width, height: stage.height }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute"
          style={{
            left: stage.imageLeft,
            top: stage.imageTop,
            width: stage.imageWidth,
            height: stage.imageHeight,
          }}
        />
        {/* The window: the wash outside it comes from its own oversized shadow,
            so there is exactly one element to move. */}
        <div
          tabIndex={0}
          role="group"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute ${round ? "rounded-full" : "rounded-lg"} ring-2 outline-none focus-visible:ring-accent ${
            fits ? "ring-white/90" : "ring-warning"
          } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            width: stage.side,
            height: stage.side,
            left: stage.left,
            top: stage.top,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          }}
        />
      </div>

      <div className="flex w-full items-center gap-2 text-muted">
        <ZoomOut className="size-3.5 shrink-0" />
        {/* Reversed: the slider fills as the frame tightens, because what grows
            on screen when you pull right is the subject, not the window. */}
        <Slider
          className="flex-1"
          aria-label={zoomLabel}
          value={MIN_ZOOM + MAX_ZOOM - clampZoom(frame.zoom)}
          minValue={MIN_ZOOM}
          maxValue={MAX_ZOOM}
          step={ZOOM_STEP}
          onChange={(value) => move({ zoom: clampZoom(MIN_ZOOM + MAX_ZOOM - (value as number)) })}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <ZoomIn className="size-3.5 shrink-0" />
      </div>
    </div>
  );
}
