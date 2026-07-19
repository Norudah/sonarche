import { Slider } from "@heroui/react";
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

  return (
    <div className="flex w-full items-center gap-3">
      <span className="w-10 text-right text-xs tabular-nums text-muted">
        {formatDuration(currentTime)}
      </span>
      <Slider
        className="player-slider flex-1"
        aria-label={t("seek")}
        value={duration ? Math.min(currentTime, duration) : 0}
        minValue={0}
        maxValue={duration || 1}
        step={1}
        isDisabled={!duration}
        onChange={(value) => seek(value as number)}
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
