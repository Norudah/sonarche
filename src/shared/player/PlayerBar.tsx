import { NowPlaying } from "@/shared/player/NowPlaying";
import { usePlayer } from "@/shared/player/PlayerContext";
import { SeekBar } from "@/shared/player/SeekBar";
import { Transport } from "@/shared/player/Transport";
import { VolumeControl } from "@/shared/player/VolumeControl";

export function PlayerBar() {
  // Deliberately does not read the playhead — `SeekBar` subscribes to it on its
  // own so this bar is not rebuilt several times a second.
  const { current, isPlaying, volume, toggle, setVolume } = usePlayer();

  return (
    <div className="flex h-player shrink-0 items-center border-t border-separator bg-surface px-6">
      <div className="flex flex-1 items-center">
        <NowPlaying current={current} isPlaying={isPlaying} />
      </div>

      <div className="flex w-[35rem] flex-col items-center gap-0.5">
        <Transport isPlaying={isPlaying} canPlay={!!current} onToggle={toggle} />
        <SeekBar />
      </div>

      <div className="flex flex-1 justify-end">
        <VolumeControl volume={volume} onVolumeChange={setVolume} />
      </div>
    </div>
  );
}
