import { Pause, Play } from "lucide-react";

import { Equalizer } from "@/shared/player/Equalizer";

interface TrackIndexCellProps {
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  label: string;
}

/** Row number by default, equalizer while this track plays, play/pause on row
 * hover. The three states share one box so the column never shifts. */
export function TrackIndexCell({ index, isCurrent, isPlaying, onPlay, label }: TrackIndexCellProps) {
  const showPause = isCurrent && isPlaying;

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={label}
      className="relative flex size-7 cursor-pointer items-center justify-center rounded-md text-[0.8125rem] tabular-nums text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="flex items-center justify-center transition-opacity group-hover/row:opacity-0">
        {showPause ? <Equalizer className="text-accent" /> : index}
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-foreground opacity-0 transition-opacity group-hover/row:opacity-100">
        {showPause ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
      </span>
    </button>
  );
}
