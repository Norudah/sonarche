import { ImagePlus } from "lucide-react";

import type { SourceSize } from "@/features/library/covers/coverCrop";
import { CropStage } from "@/features/library/covers/CropStage";
import type { LocalImage } from "@/features/library/covers/useLocalImageSource";

interface ImagePickStageProps {
  image: LocalImage | null;
  natural: SourceSize | null;
  offset: number;
  stagePx: number;
  isDropTarget: boolean;
  labels: { drop: string; formats: string; reframe: string };
  /** Circular pick target and crop window — for images worn as a disc. */
  round?: boolean;
  onPick: () => void;
  onOffset: (offset: number) => void;
  onNatural: (size: SourceSize) => void;
  /** The picked file failed to decode in the webview — drop it and say so. */
  onUnreadable: () => void;
}

/**
 * The "new image" pane both replacement modals share: an empty drop/pick
 * target, then a hidden probe while the natural size is unknown, then the
 * crop stage. What the image *becomes* (a cover, an artist disc) is the
 * caller's business; this only gets one chosen and framed.
 */
export function ImagePickStage({
  image,
  natural,
  offset,
  stagePx,
  isDropTarget,
  labels,
  round = false,
  onPick,
  onOffset,
  onNatural,
  onUnreadable,
}: ImagePickStageProps) {
  if (image == null) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={`flex flex-col items-center justify-center gap-2.5 ${round ? "rounded-full" : "rounded-xl"} border border-dashed text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
          isDropTarget
            ? "border-accent bg-accent-soft text-accent"
            : "border-separator hover:border-accent/50 hover:text-foreground"
        }`}
        style={{ width: stagePx, height: stagePx }}
      >
        <ImagePlus className="size-7 opacity-60" />
        <span className="px-6 text-center text-[0.8125rem] font-medium">{labels.drop}</span>
        <span className="text-[0.6875rem] opacity-70">{labels.formats}</span>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl ${isDropTarget ? "ring-2 ring-accent" : ""}`}
      style={{ minHeight: stagePx }}
    >
      {/* onLoad on a hidden probe when the stage needs natural dimensions
          before it can lay itself out. */}
      {natural ? (
        <CropStage
          url={image.url}
          natural={natural}
          offset={offset}
          maxPx={stagePx}
          label={labels.reframe}
          round={round}
          onOffset={onOffset}
        />
      ) : (
        <img
          src={image.url}
          alt=""
          onLoad={(event) =>
            onNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          onError={onUnreadable}
          className="max-h-full max-w-full rounded-xl opacity-0"
        />
      )}
    </div>
  );
}
