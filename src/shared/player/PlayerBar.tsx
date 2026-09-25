import type { ReactNode } from "react";

import { LyricsPanel } from "@/shared/player/LyricsPanel";
import { NowPlaying } from "@/shared/player/NowPlaying";
import { usePlayer } from "@/shared/player/PlayerContext";
import { QueuePanel } from "@/shared/player/QueuePanel";
import { SeekBar } from "@/shared/player/SeekBar";
import { Transport } from "@/shared/player/Transport";
import { VolumeControl } from "@/shared/player/VolumeControl";

interface PlayerBarProps {
  /** A slot for app-level controls (the favorites heart), since `shared`
   * can't import features. */
  accessory?: ReactNode;
}

export function PlayerBar({ accessory }: PlayerBarProps) {
  // Playhead, queue and volume are read by their own controls, not here.
  const { current, isPlaying } = usePlayer();

  return (
    <div data-tour="player" className="flex h-player shrink-0 items-center border-t border-separator bg-surface px-6">
      <div className="flex flex-1 items-center">
        <NowPlaying current={current} isPlaying={isPlaying} />
      </div>

      <div className="flex w-[35rem] flex-col items-center gap-0.5">
        <Transport />
        <SeekBar />
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        {accessory}
        <LyricsPanel />
        <QueuePanel />
        <VolumeControl />
      </div>
    </div>
  );
}
