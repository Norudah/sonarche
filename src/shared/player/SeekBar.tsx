import { Slider } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";
import { usePlayer, usePlayerProgress } from "@/shared/player/PlayerContext";

/** Reads the playhead itself so only this component re-renders with it. */
export function SeekBar() {
  const { t } = useTranslation("player");
  const { currentTime, duration } = usePlayerProgress();
  const { seek } = usePlayer();
  /** Thumb position while dragging. A single seek on release: seeking on every
   * move flooded the decoder until it gave up mid-track. */
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const position = scrubbing ?? (duration ? Math.min(currentTime, duration) : 0);

  return (
    // Room for the widened grab band.
    <div className="flex w-full items-center gap-3 py-1">
      <span className="w-10 text-right text-xs tabular-nums text-muted">{formatDuration(position)}</span>
      <Slider
        className="player-slider flex-1"
        aria-label={t("seek")}
        value={position}
        minValue={0}
        maxValue={duration || 1}
        step={1}
        isDisabled={!duration}
        onChange={(value) => setScrubbing(value as number)}
        onChangeEnd={(value) => {
          seek(value as number);
          setScrubbing(null);
        }}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <span className="w-10 text-xs tabular-nums text-muted">{formatDuration(duration)}</span>
    </div>
  );
}
