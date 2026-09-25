import { ImagePlus } from "lucide-react";

import type { CropFrame, SourceSize } from "@/features/library/covers/coverCrop";
import { CropStage } from "@/features/library/covers/CropStage";
import type { LocalImage } from "@/features/library/covers/useLocalImageSource";

interface ImagePickStageProps {
  image: LocalImage | null;
  natural: SourceSize | null;
  frame: CropFrame;
  stagePx: number;
  isDropTarget: boolean;
  labels: { drop: string; formats: string; reframe: string; zoom: string };
  /** Circular target and crop window, for disc images. */
  round?: boolean;
  onPick: () => void;
  onFrame: (frame: CropFrame) => void;
  onNatural: (size: SourceSize) => void;
  /** The file failed to decode in the webview. */
  onUnreadable: () => void;
}

/** The "new image" pane: empty target, then a hidden probe for the natural
 * size, then the crop stage. */
export function ImagePickStage({
  image,
  natural,
  frame,
  stagePx,
  isDropTarget,
  labels,
  round = false,
  onPick,
  onFrame,
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
      {/* A hidden probe reads the natural size first. */}
      {natural ? (
        <CropStage
          url={image.url}
          natural={natural}
          frame={frame}
          maxPx={stagePx}
          label={labels.reframe}
          zoomLabel={labels.zoom}
          round={round}
          onFrame={onFrame}
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
