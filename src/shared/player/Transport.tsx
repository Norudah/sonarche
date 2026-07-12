import { Button } from "@heroui/react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Transport({
  isPlaying,
  canPlay,
  onToggle,
}: {
  isPlaying: boolean;
  canPlay: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("player");

  return (
    <div className="flex items-center gap-2">
      {/* prev/next are placeholders until a playback queue exists */}
      <Button variant="ghost" size="sm" isIconOnly isDisabled aria-label={t("previous")}>
        <SkipBack className="size-4" />
      </Button>
      <Button
        variant="primary"
        size="md"
        isIconOnly
        isDisabled={!canPlay}
        onPress={onToggle}
        aria-label={isPlaying ? t("pause") : t("play")}
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      </Button>
      <Button variant="ghost" size="sm" isIconOnly isDisabled aria-label={t("next")}>
        <SkipForward className="size-4" />
      </Button>
    </div>
  );
}
