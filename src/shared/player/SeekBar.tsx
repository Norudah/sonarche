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
    <div className="flex items-center gap-3">
      <span className="w-10 text-right text-xs tabular-nums text-muted">
        {formatDuration(currentTime)}
      </span>
      <Slider
        className="flex-1"
        aria-label={t("seek")}
        value={Math.min(currentTime, duration || currentTime)}
        minValue={0}
        maxValue={duration || 0}
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
