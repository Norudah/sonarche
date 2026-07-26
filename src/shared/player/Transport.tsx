import { Button } from "@heroui/react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Swap } from "@/shared/motion/Swap";
import { springs } from "@/shared/motion/tokens";
import { usePlayer, usePlayerQueue } from "@/shared/player/PlayerContext";

/**
 * Reads its contexts itself rather than taking nine props through PlayerBar —
 * same reasoning as SeekBar. The queue subscription is cheap here: this cluster
 * displays the shuffle and repeat modes, so it re-renders exactly when they
 * change.
 */
export function Transport() {
  const { t } = useTranslation("player");
  const { current, isPlaying, toggle, next, previous } = usePlayer();
  const { queue, toggleShuffle, cycleRepeat } = usePlayerQueue();
  const canPlay = !!current;
  const hasQueue = queue.position >= 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={toggleShuffle}
        aria-label={t("shuffle")}
        aria-pressed={queue.isShuffled}
        className={queue.isShuffled ? "text-accent" : undefined}
      >
        <Shuffle className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" isIconOnly isDisabled={!hasQueue} onPress={previous} aria-label={t("previous")}>
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
          onPress={toggle}
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
      <Button variant="ghost" size="sm" isIconOnly isDisabled={!hasQueue} onPress={next} aria-label={t("next")}>
        <SkipForward className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={cycleRepeat}
        aria-label={t(queue.repeat === "one" ? "repeatOne" : queue.repeat === "all" ? "repeatAll" : "repeatOff")}
        className={queue.repeat !== "off" ? "text-accent" : undefined}
      >
        {queue.repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
      </Button>
    </div>
  );
}
