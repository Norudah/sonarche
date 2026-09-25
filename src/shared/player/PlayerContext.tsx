import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import * as engine from "@/shared/player/engine";
import {
  currentTrack,
  cycleRepeat as cycleRepeatQueue,
  emptyQueue,
  jumpTo as jumpToQueue,
  queueAfterEnded,
  queueAfterNext,
  queueAfterPrevious,
  startQueue,
  startQueueOrdered,
  startQueueShuffled,
  toggleShuffle as toggleShuffleQueue,
  type QueueState,
} from "@/shared/player/queue";
import type { PlayableTrack } from "@/shared/player/types";
import { useReportPlaybackFailure } from "@/shared/player/useReportPlaybackFailure";

/** Within this many seconds, "previous" goes back a track; after, it restarts. */
const PREVIOUS_RESTARTS_AFTER = 3;

/** Seconds before the end at which the next file is handed to the engine. */
const PRELOAD_LEAD = 8;

/** Changes only when the user acts: track, play/pause. */
interface PlayerControls {
  current: PlayableTrack | null;
  isPlaying: boolean;
  /** A single track is a queue of one. */
  play: (tracks: PlayableTrack[], startIndex?: number) => void;
  /** "Play all": sequential from the top. */
  playOrdered: (tracks: PlayableTrack[]) => void;
  /** Always a fresh draw, never a pause. */
  playShuffled: (tracks: PlayableTrack[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
}

/** Updates several times a second during playback. */
interface PlayerProgress {
  currentTime: number;
  duration: number;
}

/** Its own context: a drag updates it dozens of times a second. */
interface PlayerVolume {
  volume: number;
  setVolume: (value: number) => void;
}

/** Only transport toggles and the queue panel read this, not list rows. */
interface PlayerQueue {
  queue: QueueState;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  jumpTo: (position: number) => void;
}

/**
 * Four contexts so continuous updates don't re-render every consumer: each
 * track row reads `usePlayer()`, and a single context carrying the playhead
 * or the volume would re-render the whole list several times a second. Only
 * values that change when the user acts on playback belong in the controls.
 */
const ControlsContext = createContext<PlayerControls | null>(null);
const ProgressContext = createContext<PlayerProgress | null>(null);
const QueueContext = createContext<PlayerQueue | null>(null);
const VolumeContext = createContext<PlayerVolume | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueue] = useState<QueueState>(emptyQueue);

  // Refs keep callbacks stable: new identities would re-render every row.
  const currentIdRef = useRef<PlayableTrack["id"] | null>(null);
  currentIdRef.current = current?.id ?? null;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const positionRef = useRef(0);
  positionRef.current = currentTime;
  /** Load token: ticks arriving before the engine answers describe the previous
   * track and would move the playhead backwards. */
  const loadingRef = useRef(0);
  /** Seek token: the tick in flight describes the old position and would snap
   * the thumb back. */
  const seekingRef = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = duration;
  /** The track handed to the engine as next. Cleared by every load. */
  const preloadedRef = useRef<PlayableTrack | null>(null);

  const reportFailure = useReportPlaybackFailure();

  /** Makes a track current without loading it: after a gapless hand-over the
   * engine is already playing it. */
  const adopt = useCallback((track: PlayableTrack, decoded?: number | null) => {
    setCurrent(track);
    setCurrentTime(0);
    setDuration(decoded ?? track.duration ?? 0);
    setIsPlaying(true);

    // OS media session; the engine only knows file paths.
    void engine.setNowPlaying({
      title: track.title,
      artist: track.subtitle,
      artPath: track.artPath,
      duration: track.duration,
    });
  }, []);

  /** The single path for launches, skips and auto-advance. State updates
   * before the round-trip; the engine's decoded duration replaces the
   * library's when it arrives. */
  const loadTrack = useCallback(
    (track: PlayableTrack) => {
      adopt(track);
      preloadedRef.current = null;

      const token = loadingRef.current + 1;
      loadingRef.current = token;
      void engine.load(track.path).then(
        (decoded) => {
          // Overtaken by a newer load.
          if (loadingRef.current !== token) return;
          if (decoded != null) setDuration(decoded);
        },
        (error: unknown) => {
          if (loadingRef.current !== token) return;
          setIsPlaying(false);
          reportFailure(error, track.title);
        },
      );
    },
    [adopt, reportFailure],
  );

  /** Updates locally first and ignores engine ticks until the seek is confirmed. */
  const seek = useCallback((time: number) => {
    setCurrentTime(time);
    const token = seekingRef.current + 1;
    seekingRef.current = token;
    void engine.seek(time).finally(() => {
      if (seekingRef.current === token) seekingRef.current = 0;
    });
  }, []);

  /** Applies a queue transition; landing on the loaded track restarts it. */
  const applyQueue = useCallback(
    (nextState: QueueState) => {
      setQueue(nextState);
      const track = currentTrack(nextState);
      if (!track) return;
      if (track.id === currentIdRef.current) {
        seek(0);
        return;
      }
      loadTrack(track);
    },
    [loadTrack, seek],
  );

  /** Hands the engine the next file near the end of the current one, for a
   * gapless transition. Not earlier: the queue (e.g. shuffle) may still change. */
  const preloadNext = useCallback((position: number) => {
    if (preloadedRef.current) return;
    const total = durationRef.current;
    if (!total || total - position > PRELOAD_LEAD) return;

    const nextState = queueAfterEnded(queueRef.current);
    const track = nextState && currentTrack(nextState);
    if (!track) return;
    preloadedRef.current = track;
    void engine.enqueue(track.path).catch(() => {
      // Unreadable: let the track end; `loadTrack` will report it then.
      if (preloadedRef.current === track) preloadedRef.current = null;
    });
  }, []);

  // Engine status ticks (4/s while playing).
  useEffect(() => {
    const unlisten = engine.onStatus((status) => {
      // Skip ticks from the previous track or during a seek.
      if (status.loaded && !seekingRef.current) setCurrentTime(status.position);
      setIsPlaying(status.isPlaying);
      if (status.loaded) preloadNext(status.position);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [preloadNext]);

  // Gapless hand-over: nothing to load, only the queue and display catch up.
  useEffect(() => {
    const unlisten = engine.onAdvanced(({ path, duration: decoded }) => {
      preloadedRef.current = null;
      const nextState = queueAfterEnded(queueRef.current);
      const track = nextState && currentTrack(nextState);
      if (!nextState || !track) {
        // The queue has nowhere to go (e.g. repeat turned off at the end).
        void engine.stop();
        setIsPlaying(false);
        return;
      }
      setQueue(nextState);
      // The queue changed after preloading: reload, despite the gap.
      if (track.path === path) adopt(track, decoded);
      else loadTrack(track);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [adopt, loadTrack]);

  useEffect(() => {
    const unlisten = engine.onEnded(() => {
      const nextState = queueAfterEnded(queueRef.current);
      if (!nextState) {
        // End of queue: keep the queue and playhead as they were.
        setIsPlaying(false);
        return;
      }
      applyQueue(nextState);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [applyQueue]);

  /** Optimistic play/pause; the engine confirms 250 ms later. */
  const flip = useCallback(() => {
    setIsPlaying((playing) => !playing);
    void engine.toggle().then(
      (playing) => setIsPlaying(playing),
      () => setIsPlaying(false),
    );
  }, []);

  const play = useCallback(
    (tracks: PlayableTrack[], startIndex = 0) => {
      const target = tracks[startIndex];
      if (!target) return;
      // Clicking the playing track toggles it.
      if (currentIdRef.current === target.id) {
        flip();
        return;
      }
      setQueue(startQueue(queueRef.current, tracks, startIndex));
      loadTrack(target);
    },
    [flip, loadTrack],
  );

  const playOrdered = useCallback(
    (tracks: PlayableTrack[]) => {
      const target = tracks[0];
      if (!target) return;
      // Same toggle guard as `play`.
      if (currentIdRef.current === target.id) {
        flip();
        return;
      }
      setQueue(startQueueOrdered(queueRef.current, tracks));
      loadTrack(target);
    },
    [flip, loadTrack],
  );

  const playShuffled = useCallback(
    (tracks: PlayableTrack[]) => {
      const nextState = startQueueShuffled(queueRef.current, tracks);
      const track = currentTrack(nextState);
      if (!track) return;
      setQueue(nextState);
      // No toggle guard: shuffle always relaunches.
      loadTrack(track);
    },
    [loadTrack],
  );

  const toggle = useCallback(() => {
    if (currentIdRef.current == null) return;
    flip();
  }, [flip]);

  const next = useCallback(() => {
    const nextState = queueAfterNext(queueRef.current);
    if (nextState) applyQueue(nextState);
  }, [applyQueue]);

  const previous = useCallback(() => {
    if (currentIdRef.current == null) return;
    if (positionRef.current <= PREVIOUS_RESTARTS_AFTER) {
      const prevState = queueAfterPrevious(queueRef.current);
      if (prevState) {
        applyQueue(prevState);
        return;
      }
    }
    seek(0);
  }, [applyQueue, seek]);

  /** `value` is the 0…1 slider position; the engine applies the taper. */
  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    void engine.setVolume(value);
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

  // OS media controls reuse the on-screen transport callbacks.
  useEffect(() => {
    const unlisten = engine.onRemote((action) => {
      if (typeof action === "object") {
        seek(action.seek);
        return;
      }
      switch (action) {
        case "next":
          next();
          break;
        case "previous":
          previous();
          break;
        case "stop":
          void engine.stop();
          setIsPlaying(false);
          break;
        // The engine knows the current state.
        default:
          toggle();
      }
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [next, previous, seek, toggle]);

  const controls = useMemo<PlayerControls>(
    () => ({ current, isPlaying, play, playOrdered, playShuffled, toggle, next, previous, seek }),
    [current, isPlaying, play, playOrdered, playShuffled, toggle, next, previous, seek],
  );

  const progress = useMemo<PlayerProgress>(() => ({ currentTime, duration }), [currentTime, duration]);

  const volumeValue = useMemo<PlayerVolume>(() => ({ volume, setVolume }), [volume, setVolume]);

  const queueValue = useMemo<PlayerQueue>(
    () => ({ queue, toggleShuffle, cycleRepeat, jumpTo }),
    [queue, toggleShuffle, cycleRepeat, jumpTo],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <ProgressContext.Provider value={progress}>
        <QueueContext.Provider value={queueValue}>
          <VolumeContext.Provider value={volumeValue}>{children}</VolumeContext.Provider>
        </QueueContext.Provider>
      </ProgressContext.Provider>
    </ControlsContext.Provider>
  );
}

/** Safe to call from list rows. */
export function usePlayer(): PlayerControls {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

/** Re-renders several times a second: only for components drawing the position. */
export function usePlayerProgress(): PlayerProgress {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("usePlayerProgress must be used within a PlayerProvider");
  return ctx;
}

export function usePlayerQueue(): PlayerQueue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("usePlayerQueue must be used within a PlayerProvider");
  return ctx;
}

/** Call from the control that draws it, never from a parent. */
export function usePlayerVolume(): PlayerVolume {
  const ctx = useContext(VolumeContext);
  if (!ctx) throw new Error("usePlayerVolume must be used within a PlayerProvider");
  return ctx;
}
