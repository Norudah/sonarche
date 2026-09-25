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

/** One slider notch, and one arrow press. */
const ZOOM_STEP = 0.02;

/**
 * Crop by moving and sizing a window over the whole image (outside is washed
 * out; see `stageLayout`). Past the largest square the frame may leave the
 * picture: the ring turns amber and the caller can't confirm.
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
  /** Stage ceiling in CSS px (the long side). */
  maxPx: number;
  /** Accessible name for the frame. */
  label: string;
  /** Accessible name for the zoom slider. */
  zoomLabel: string;
  /** Circular window for disc images (artists); the saved image stays square. */
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

  // Subscribed manually: React's `onWheel` is passive, so `preventDefault`
  // would fail and the modal would scroll too.
  const boxRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<(delta: number) => void>(() => {});
  wheelRef.current = (delta) => move({ zoom: clampZoom(frame.zoom + delta * 0.0015) });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Coalesced to one update per frame.
    let raf = 0;
    let pending = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      pending += event.deltaY;
      if (raf === 0)
        raf = requestAnimationFrame(() => {
          raf = 0;
          const delta = pending;
          pending = 0;
          wheelRef.current(delta);
        });
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      box.removeEventListener("wheel", onWheel);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, []);

  const canDrag = stage.travelX > 0 || stage.travelY > 0;

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: maxPx }}>
      {/* Fixed-footprint viewport, so the modal doesn't move while zooming. */}
      <div className="flex items-center justify-center" style={{ width: maxPx, height: maxPx }}>
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
          {/* The wash outside is the window's own oversized shadow. */}
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
      </div>

      <div className="flex w-full items-center gap-2 text-muted">
        <ZoomOut className="size-3.5 shrink-0" />
        {/* Reversed: the slider fills as the frame tightens. */}
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
