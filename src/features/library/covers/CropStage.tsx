import { useRef } from "react";

import { clampOffset, stageLayout, type SourceSize } from "@/features/library/covers/coverCrop";

/**
 * The crop, chosen by moving the frame itself.
 *
 * The whole image is shown, the square window slides along the long axis, and
 * everything outside it is washed out — what stays bright is exactly what the
 * cover will be. Dragging the window (or the image) moves it; it is also a
 * real slider to the keyboard, arrows moving it in 5% steps.
 */
export function CropStage({
  url,
  natural,
  offset,
  maxPx,
  label,
  onOffset,
}: {
  url: string;
  natural: SourceSize;
  offset: number;
  /** Stage ceiling, CSS px — the long side fits this. */
  maxPx: number;
  /** Accessible name for the window's slider role. */
  label: string;
  onOffset: (offset: number) => void;
}) {
  const stage = stageLayout(natural, maxPx);
  const position = clampOffset(offset) * stage.travel;
  const drag = useRef<{ pointerId: number; start: number; startOffset: number } | null>(null);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stage.travel === 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      start: stage.horizontal ? event.clientX : event.clientY,
      startOffset: clampOffset(offset),
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held || held.pointerId !== event.pointerId) return;
    const delta = (stage.horizontal ? event.clientX : event.clientY) - held.start;
    onOffset(clampOffset(held.startOffset + delta / stage.travel));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 0.05
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -0.05
          : null;
    if (step != null) {
      event.preventDefault();
      onOffset(clampOffset(offset + step));
      return;
    }
    if (event.key === "Home") onOffset(0);
    if (event.key === "End") onOffset(1);
  };

  return (
    <div
      className="relative touch-none overflow-hidden rounded-xl ring-1 ring-artwork-edge select-none"
      style={{ width: stage.width, height: stage.height }}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img src={url} alt="" draggable={false} className="size-full object-cover" />
      {/* The window: the wash outside it comes from its own oversized shadow,
          so there is exactly one element to move. */}
      <div
        role={stage.travel > 0 ? "slider" : undefined}
        tabIndex={stage.travel > 0 ? 0 : undefined}
        aria-label={label}
        aria-orientation={stage.horizontal ? "horizontal" : "vertical"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampOffset(offset) * 100)}
        onKeyDown={onKeyDown}
        className={`absolute rounded-lg ring-2 ring-white/90 outline-none focus-visible:ring-accent ${
          stage.travel > 0 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{
          width: stage.side,
          height: stage.side,
          left: stage.horizontal ? position : 0,
          top: stage.horizontal ? 0 : position,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
        }}
      />
    </div>
  );
}
