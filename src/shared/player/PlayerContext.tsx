import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { PlayableTrack } from "@/shared/player/types";

interface PlayerContextValue {
  current: PlayableTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  play: (track: PlayableTrack) => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  // True once a known (library metadata) duration has been set for the current track,
  // so the browser's own (unreliable, for asset:// AAC streams) estimate doesn't override it.
  const knownDurationRef = useRef(false);

  // Sync React state with the <audio> element, the external system that owns playback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (!knownDurationRef.current) setDuration(audio.duration || 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const play = (track: PlayableTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (current?.id === track.id) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setCurrent(track);
    setCurrentTime(0);
    knownDurationRef.current = track.duration != null;
    setDuration(track.duration ?? 0);
    audio.src = track.src;
    void audio.play();
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (value: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = value;
    setVolumeState(value);
  };

  const value = useMemo<PlayerContextValue>(
    () => ({ current, isPlaying, currentTime, duration, volume, play, toggle, seek, setVolume }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, isPlaying, currentTime, duration, volume],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} onVolumeChange={() => setVolumeState(audioRef.current?.volume ?? 1)} />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
