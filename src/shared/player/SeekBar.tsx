import { Slider } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";
import { usePlayer, usePlayerProgress } from "@/shared/player/PlayerContext";

/**
 * Reads the playhead itself instead of taking it as a prop, and that is the
 * point: the position changes several times a second, so having the player bar
 * hold it meant the bar — and with it the artwork, the transport and the volume
 * slider — re-rendered at the same rate. The churn now stops at this component.
 */
export function SeekBar() {
  const { t } = useTranslation("player");
  const { currentTime, duration } = usePlayerProgress();
  const { seek } = usePlayer();
  /**
   * Where the thumb is while the pointer holds it, and null the rest of the
   * time. The drag used to seek on every pointer move: each one waits on the
   * audio thread and reopens the decoder, so a single gesture sent dozens of
   * them, the playhead lagged behind the thumb, and a decoder asked to jump
   * that often eventually gave up mid-track — which the player answered by
   * skipping to the next song. One seek, when the pointer is released.
   */
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const position = scrubbing ?? (duration ? Math.min(currentTime, duration) : 0);

  return (
    // `py-1` is what the widened grab band needs to live in: without it the
    // band would reach past the row and over the transport buttons above.
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
