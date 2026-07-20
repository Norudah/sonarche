import { AnimatePresence, motion } from "motion/react";
import { Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Swap } from "@/shared/motion/Swap";
import { durations, easings, fade } from "@/shared/motion/tokens";
import { Equalizer } from "@/shared/player/Equalizer";
import type { PlayableTrack } from "@/shared/player/types";

export function NowPlaying({ current, isPlaying }: { current: PlayableTrack | null; isPlaying: boolean }) {
  const { t } = useTranslation("player");
  // The frame stays put; only what sits inside it swaps. Keying on the track id
  // (not on the art URL) means a track whose cover lands late does not re-run
  // the transition — the row is still the same song.
  const trackKey = current?.id ?? "idle";

  return (
    <div className="flex w-56 shrink-0 items-center gap-3">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-default/60">
        <Swap swapKey={trackKey} className="flex h-full w-full items-center justify-center">
          {current?.artUrl ? (
            <img src={current.artUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music className="size-5 text-muted" />
          )}
        </Swap>
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="absolute inset-0 flex items-center justify-center bg-black/35"
            >
              <Equalizer className="text-accent-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Swap
        swapKey={trackKey}
        className="block min-w-0"
        animate={{ opacity: 1, y: [5, 0] }}
        transition={{ duration: durations.medium, ease: easings.out }}
      >
        {current ? (
          <>
            <p className="truncate text-sm font-medium">{current.title}</p>
            {current.subtitle && <p className="truncate text-xs text-muted">{current.subtitle}</p>}
          </>
        ) : (
          <p className="truncate text-sm text-muted">{t("nothingPlaying")}</p>
        )}
      </Swap>
    </div>
  );
}
