import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { trackDuration } from "@/shared/player/duration";
import {
  currentTrack,
  cycleRepeat as cycleRepeatQueue,
  emptyQueue,
  jumpTo as jumpToQueue,
  queueAfterEnded,
  queueAfterNext,
  queueAfterPrevious,
  startQueue,
  toggleShuffle as toggleShuffleQueue,
  type QueueState,
} from "@/shared/player/queue";
import type { PlayableTrack } from "@/shared/player/types";
import { useMediaSession } from "@/shared/player/useMediaSession";

/** Pressing previous inside a track's opening seconds means "go back one";
 * after that it means "start this one over". The universal threshold. */
const PREVIOUS_RESTARTS_AFTER = 3;

/**
 * What the player is doing. Changes only when the user acts — a new track, a
 * play/pause, a volume drag.
 */
interface PlayerControls {
  current: PlayableTrack | null;
  isPlaying: boolean;
  volume: number;
  /** Launch a set from the clicked track. A solo play is a queue of one. */
  play: (tracks: PlayableTrack[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
}

/** Where the playhead is. Changes several times a second during playback. */
interface PlayerProgress {
  currentTime: number;
  duration: number;
}

/** The queue and its modes. Only the transport toggles and the queue panel
 * read this — list rows must keep re-rendering on `current` alone. */
interface PlayerQueue {
  queue: QueueState;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  jumpTo: (position: number) => void;
}

/**
 * Three contexts rather than one, and the split is the whole point.
 *
 * `timeupdate` fires about four times a second, so a single context value
 * carrying `currentTime` changed four times a second — and re-rendered every
 * consumer with it. Every track row calls `usePlayer()` for `current` and
 * `isPlaying` alone, so a 300-track library was re-rendering 300 rows four
 * times a second to redraw a playhead none of them display.
 *
 * Only the seek bar subscribes to progress, and only the transport toggles and
 * the queue panel subscribe to the queue. Rows sit on the stable controls half
 * and re-render when something they actually show changes.
 */
const ControlsContext = createContext<PlayerControls | null>(null);
const ProgressContext = createContext<PlayerProgress | null>(null);
const QueueContext = createContext<PlayerQueue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueue] = useState<QueueState>(emptyQueue);
  // The playing track's library duration, read from the element's own listeners.
  // A ref, not state, so the listeners stay attached once for the app's life.
  const knownDurationRef = useRef<number | null>(null);

  // Read through refs so the callbacks never have to list the playing track or
  // the queue as dependencies: a new identity here would ripple out to every row.
  const currentIdRef = useRef<PlayableTrack["id"] | null>(null);
  currentIdRef.current = current?.id ?? null;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  /** Point the element at a track and start it. The one path every launch,
   * skip and auto-advance goes through. */
  const loadTrack = useCallback((track: PlayableTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(track);
    setCurrentTime(0);
    knownDurationRef.current = track.duration ?? null;
    setDuration(track.duration ?? 0);
    audio.src = track.src;
    void audio.play();
  }, []);

  /** Apply a queue transition and make the audio follow it. A transition that
   * lands on the already-loaded track restarts it instead of reloading. */
  const applyQueue = useCallback(
    (nextState: QueueState) => {
      setQueue(nextState);
      const track = currentTrack(nextState);
      if (!track) return;
      const audio = audioRef.current;
      if (track.id === currentIdRef.current && audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
        void audio.play();
        return;
      }
      loadTrack(track);
    },
    [loadTrack],
  );

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
    const onEnded = () => {
      const nextState = queueAfterEnded(queueRef.current);
      if (!nextState) {
        setIsPlaying(false);
        return;
      }
      applyQueue(nextState);
    };
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
  }, [applyQueue]);

  const play = useCallback(
    (tracks: PlayableTrack[], startIndex = 0) => {
      const audio = audioRef.current;
      const target = tracks[startIndex];
      if (!audio || !target) return;
      // Clicking the playing track toggles it; the queue it came from stays.
      if (currentIdRef.current === target.id) {
        if (audio.paused) void audio.play();
        else audio.pause();
        return;
      }
      setQueue(startQueue(queueRef.current, tracks, startIndex));
      loadTrack(target);
    },
    [loadTrack],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || currentIdRef.current == null) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  const next = useCallback(() => {
    const nextState = queueAfterNext(queueRef.current);
    if (nextState) applyQueue(nextState);
  }, [applyQueue]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || currentIdRef.current == null) return;
    if (audio.currentTime <= PREVIOUS_RESTARTS_AFTER) {
      const prevState = queueAfterPrevious(queueRef.current);
      if (prevState) {
        applyQueue(prevState);
        return;
      }
    }
    // Past the threshold — or already at the front: start the track over.
    audio.currentTime = 0;
    setCurrentTime(0);
  }, [applyQueue]);

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

  const toggleShuffle = useCallback(() => {
    setQueue(toggleShuffleQueue(queueRef.current));
  }, []);

  const cycleRepeat = useCallback(() => {
    setQueue(cycleRepeatQueue(queueRef.current));
  }, []);

  const jumpTo = useCallback(
    (position: number) => {
      const nextState = jumpToQueue(queueRef.current, position);
      if (nextState !== queueRef.current) applyQueue(nextState);
    },
    [applyQueue],
  );

  useMediaSession({ current, isPlaying, toggle, next, previous });

  const controls = useMemo<PlayerControls>(
    () => ({ current, isPlaying, volume, play, toggle, next, previous, seek, setVolume }),
    [current, isPlaying, volume, play, toggle, next, previous, seek, setVolume],
  );

  const progress = useMemo<PlayerProgress>(() => ({ currentTime, duration }), [currentTime, duration]);

  const queueValue = useMemo<PlayerQueue>(
    () => ({ queue, toggleShuffle, cycleRepeat, jumpTo }),
    [queue, toggleShuffle, cycleRepeat, jumpTo],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <ProgressContext.Provider value={progress}>
        <QueueContext.Provider value={queueValue}>
          {children}
          <audio ref={audioRef} onVolumeChange={() => setVolumeState(audioRef.current?.volume ?? 1)} />
        </QueueContext.Provider>
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

/** The queue and its modes. For the transport toggles and the queue panel —
 * a list row has no business re-rendering when the queue changes. */
export function usePlayerQueue(): PlayerQueue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("usePlayerQueue must be used within a PlayerProvider");
  return ctx;
}
