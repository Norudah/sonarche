import type { ReactNode } from "react";

import { LyricsPanel } from "@/shared/player/LyricsPanel";
import { NowPlaying } from "@/shared/player/NowPlaying";
import { usePlayer } from "@/shared/player/PlayerContext";
import { QueuePanel } from "@/shared/player/QueuePanel";
import { SeekBar } from "@/shared/player/SeekBar";
import { Transport } from "@/shared/player/Transport";
import { VolumeControl } from "@/shared/player/VolumeControl";

interface PlayerBarProps {
  /** An app-level control for the annex row — the favorites heart. A slot
   * because this bar lives in `shared` and must not know the features that
   * want a seat on it; the app shell decides what rides along. */
  accessory?: ReactNode;
}

export function PlayerBar({ accessory }: PlayerBarProps) {
  // Deliberately does not read the playhead, the queue or the volume — those
  // controls subscribe on their own so this bar is not rebuilt with them.
  const { current, isPlaying } = usePlayer();

  return (
    <div className="flex h-player shrink-0 items-center border-t border-separator bg-surface px-6">
      <div className="flex flex-1 items-center">
        <NowPlaying current={current} isPlaying={isPlaying} />
      </div>

      <div className="flex w-[35rem] flex-col items-center gap-0.5">
        <Transport />
        <SeekBar />
      </div>

      {/* Right side is the annex row — what plays next, and the words to what
       * plays now — with volume keeping the outer edge. */}
      <div className="flex flex-1 items-center justify-end gap-3">
        {accessory}
        <LyricsPanel />
        <QueuePanel />
        <VolumeControl />
      </div>
    </div>
  );
}
