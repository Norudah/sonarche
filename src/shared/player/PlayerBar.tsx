import { NowPlaying } from "@/shared/player/NowPlaying";
import { usePlayer } from "@/shared/player/PlayerContext";
import { SeekBar } from "@/shared/player/SeekBar";
import { Transport } from "@/shared/player/Transport";
import { VolumeControl } from "@/shared/player/VolumeControl";

export function PlayerBar() {
  const { current, isPlaying, currentTime, duration, volume, toggle, seek, setVolume } = usePlayer();

  return (
    <div className="flex h-player shrink-0 items-center border-t border-separator bg-surface px-6">
      <div className="flex flex-1 items-center">
        <NowPlaying current={current} isPlaying={isPlaying} />
      </div>

      <div className="flex w-[35rem] flex-col items-center gap-0.5">
        <Transport isPlaying={isPlaying} canPlay={!!current} onToggle={toggle} />
        <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
      </div>

      <div className="flex flex-1 justify-end">
        <VolumeControl volume={volume} onVolumeChange={setVolume} />
      </div>
    </div>
  );
}
