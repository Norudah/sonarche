import { Button, Slider } from "@heroui/react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePlayerVolume } from "@/shared/player/PlayerContext";

/**
 * Subscribes to the volume itself rather than taking it as a prop: a drag moves
 * the value dozens of times a second, and passing it down would re-render the
 * player bar — and everything else it renders — on every one of them.
 */
export function VolumeControl() {
  const { t } = useTranslation("player");
  const { volume, setVolume } = usePlayerVolume();
  const muted = volume === 0;
  const Icon = muted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-28 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={() => setVolume(muted ? 1 : 0)}
        aria-label={muted ? t("unmute") : t("mute")}
      >
        <Icon className="size-4" />
      </Button>
      <Slider
        className="volume-slider flex-1"
        aria-label={t("volume")}
        value={volume}
        minValue={0}
        maxValue={1}
        step={0.01}
        onChange={(value) => setVolume(value as number)}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}
