import { Music } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Equalizer } from "@/shared/player/Equalizer";
import type { PlayableTrack } from "@/shared/player/types";

export function NowPlaying({ current, isPlaying }: { current: PlayableTrack | null; isPlaying: boolean }) {
  const { t } = useTranslation("player");

  return (
    <div className="flex w-56 shrink-0 items-center gap-3">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-default/60">
        {current?.artUrl ? <img src={current.artUrl} alt="" className="h-full w-full object-cover" /> : <Music className="size-5 text-muted" />}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <Equalizer />
          </div>
        )}
      </div>
      <div className="min-w-0">
        {current ? (
          <>
            <p className="truncate text-sm font-medium">{current.title}</p>
            {current.subtitle && <p className="truncate text-xs text-muted">{current.subtitle}</p>}
          </>
        ) : (
          <p className="truncate text-sm text-muted">{t("nothingPlaying")}</p>
        )}
      </div>
    </div>
  );
}
