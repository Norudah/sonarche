import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { trackDuration } from "@/shared/player/duration";
import type { PlayableTrack } from "@/shared/player/types";

/**
 * What the player is doing. Changes only when the user acts — a new track, a
 * play/pause, a volume drag.
 */
interface PlayerControls {
  current: PlayableTrack | null;
  isPlaying: boolean;
  volume: number;
  play: (track: PlayableTrack) => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
}

/** Where the playhead is. Changes several times a second during playback. */
interface PlayerProgress {
  currentTime: number;
  duration: number;
}

/**
 * Two contexts rather than one, and the split is the whole point.
 *
 * `timeupdate` fires about four times a second, so a single context value
 * carrying `currentTime` changed four times a second — and re-rendered every
 * consumer with it. Every track row calls `usePlayer()` for `current` and
 * `isPlaying` alone, so a 300-track library was re-rendering 300 rows four
 * times a second to redraw a playhead none of them display.
 *
 * Only the seek bar subscribes to progress now. Rows and transport controls sit
 * on the stable half and re-render when something they actually show changes.
 */
const ControlsContext = createContext<PlayerControls | null>(null);
const ProgressContext = createContext<PlayerProgress | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  // The playing track's library duration, read from the element's own listeners.
  // A ref, not state, so the listeners stay attached once for the app's life.
  const knownDurationRef = useRef<number | null>(null);

  // Sync React state with the <audio> element, the external system that owns playback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      setDuration(trackDuration(knownDurationRef.current, audio.duration) ?? 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Read through a ref so `play` never has to list the playing track as a
  // dependency: a new identity here would ripple out to every row.
  const currentIdRef = useRef<PlayableTrack["id"] | null>(null);
  currentIdRef.current = current?.id ?? null;

  const play = useCallback((track: PlayableTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentIdRef.current === track.id) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setCurrent(track);
    setCurrentTime(0);
    knownDurationRef.current = track.duration ?? null;
    setDuration(track.duration ?? 0);
    audio.src = track.src;
    void audio.play();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || currentIdRef.current == null) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((value: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = value;
    setVolumeState(value);
  }, []);

  const controls = useMemo<PlayerControls>(
    () => ({ current, isPlaying, volume, play, toggle, seek, setVolume }),
    [current, isPlaying, volume, play, toggle, seek, setVolume],
  );

  const progress = useMemo<PlayerProgress>(() => ({ currentTime, duration }), [currentTime, duration]);

  return (
    <ControlsContext.Provider value={controls}>
      <ProgressContext.Provider value={progress}>
        {children}
        <audio ref={audioRef} onVolumeChange={() => setVolumeState(audioRef.current?.volume ?? 1)} />
      </ProgressContext.Provider>
    </ControlsContext.Provider>
  );
}

/** What is playing and how to drive it. Safe to call from a list row. */
export function usePlayer(): PlayerControls {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

/**
 * The playhead. Only call this from something that draws the position — it
 * updates several times a second, and every caller re-renders with it.
 */
export function usePlayerProgress(): PlayerProgress {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("usePlayerProgress must be used within a PlayerProvider");
  return ctx;
}
