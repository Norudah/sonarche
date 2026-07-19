import { Button } from "@heroui/react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";

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
      {/* The press scale lives on a wrapper, not the Button: HeroUI already owns
          the button's own pressed styling, and fighting it would mean reaching
          into its internals. */}
      <motion.div whileTap={canPlay ? { scale: 0.88 } : undefined} transition={springs.snappy}>
        <Button
          variant="primary"
          size="md"
          isIconOnly
          isDisabled={!canPlay}
          onPress={onToggle}
          aria-label={isPlaying ? t("pause") : t("play")}
        >
          {/* `cross`, not the default `wait`: this slot is a fixed-size icon in
              a filled circle, so waiting for the old glyph to leave showed an
              empty accent disc. And `snappy` over `bouncy` — a transport button
              is pressed in sequence, it cannot afford a settle. */}
          <Swap
            swapKey={isPlaying ? "pause" : "play"}
            mode="cross"
            className="flex items-center justify-center"
            animate={{ opacity: 1, scale: [0.7, 1] }}
            transition={springs.snappy}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Swap>
        </Button>
      </motion.div>
      <Button variant="ghost" size="sm" isIconOnly isDisabled aria-label={t("next")}>
        <SkipForward className="size-4" />
      </Button>
    </div>
  );
}
