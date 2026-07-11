import { Button, Slider } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

export function PlayerBar() {
  const { t } = useTranslation("player");
  const { current, isPlaying, currentTime, duration, toggle, seek } = usePlayer();

  if (!current) return null;

  return (
    <div className="flex items-center gap-4 border-t border-default/40 bg-default/20 px-6 py-3">
      {current.artUrl ? (
        <img src={current.artUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-default/60 text-lg">
          ♪
        </div>
      )}

      <div className="w-48 shrink-0">
        <p className="truncate font-medium">{current.title}</p>
        {current.subtitle && (
          <p className="truncate text-sm text-muted-foreground">{current.subtitle}</p>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        onPress={toggle}
        aria-label={isPlaying ? t("pause") : t("play")}
      >
        {isPlaying ? "⏸" : "▶"}
      </Button>

      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
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
        onChange={(value) => seek(value as number)}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      <span className="w-10 text-xs tabular-nums text-muted-foreground">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
