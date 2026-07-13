import { Slider } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";

export function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const { t } = useTranslation("player");

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
        onChange={(value) => onSeek(value as number)}
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
