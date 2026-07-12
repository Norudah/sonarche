import { NowPlaying } from "@/shared/player/NowPlaying";
import { usePlayer } from "@/shared/player/PlayerContext";
import { SeekBar } from "@/shared/player/SeekBar";
import { Transport } from "@/shared/player/Transport";
import { VolumeControl } from "@/shared/player/VolumeControl";

export function PlayerBar() {
  const { current, isPlaying, currentTime, duration, volume, toggle, seek, setVolume } =
    usePlayer();

  return (
    <div className="flex h-player shrink-0 flex-col justify-center gap-1.5 border-t border-separator bg-surface px-6 py-2">
      <div className="flex items-center gap-4">
        <NowPlaying current={current} isPlaying={isPlaying} />
        <div className="flex flex-1 justify-center">
          <Transport isPlaying={isPlaying} canPlay={!!current} onToggle={toggle} />
        </div>
        <div className="flex w-56 shrink-0 justify-end">
          <VolumeControl volume={volume} onVolumeChange={setVolume} />
        </div>
      </div>
      <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
    </div>
  );
}
