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

/** Pressing previous inside a track's opening seconds means "go back one";
 * after that it means "start this one over". The universal threshold. */
const PREVIOUS_RESTARTS_AFTER = 3;

/** How long before the end the next file is handed to the engine, in seconds.
 * Only has to beat the time it takes to open a decoder; the rest of the margin
 * is there so a stalled status tick cannot cost the hand-over. */
const PRELOAD_LEAD = 8;

/**
 * What the player is doing. Changes only when the user acts — a new track, a
 * play/pause, a volume drag.
 */
interface PlayerControls {
  current: PlayableTrack | null;
  isPlaying: boolean;
  /** Launch a set from the clicked track. A solo play is a queue of one. */
  play: (tracks: PlayableTrack[], startIndex?: number) => void;
  /** "Play all": launch a set from the top, forcing sequential order. */
  playOrdered: (tracks: PlayableTrack[]) => void;
  /** "Shuffle": launch a set shuffled from a random opener. Always relaunches
   * — pressing it again is a request for a fresh draw, never a pause. */
  playShuffled: (tracks: PlayableTrack[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
}

/** Where the playhead is. Changes several times a second during playback. */
interface PlayerProgress {
  currentTime: number;
  duration: number;
}

/** Output level. Its own context because a drag moves it dozens of times a
 * second, and only the volume slider draws it. */
interface PlayerVolume {
  volume: number;
  setVolume: (value: number) => void;
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
 * Four contexts rather than one, and the split is the whole point.
 *
 * `timeupdate` fires about four times a second, so a single context value
 * carrying `currentTime` changed four times a second — and re-rendered every
 * consumer with it. Every track row calls `usePlayer()` for `current` and
 * `isPlaying` alone, so a 300-track library was re-rendering 300 rows four
 * times a second to redraw a playhead none of them display.
 *
 * Volume is split off for the same reason and was missed the first time: a
 * slider drag moves it dozens of times a second, and it rode on the controls
 * value that every row subscribes to, so dragging it re-rendered the whole
 * mounted list to move a control none of them own.
 *
 * The rule the split follows: a value belongs with the controls only if it
 * changes when the user acts on *playback*. Anything that changes continuously
 * — a playhead, a drag — gets its own context and its own subscribers.
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

  // Read through refs so the callbacks never have to list the playing track or
  // the queue as dependencies: a new identity here would ripple out to every row.
  const currentIdRef = useRef<PlayableTrack["id"] | null>(null);
  currentIdRef.current = current?.id ?? null;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  /** The playhead, for the callbacks that read it without drawing it —
   * `previous` needs to know how far in we are, and must not re-create itself
   * four times a second to find out. */
  const positionRef = useRef(0);
  positionRef.current = currentTime;
  /** Guards the status stream against a load still in flight: a tick that
   * arrives between "the user clicked" and "the engine answered" describes the
   * previous track, and would drag the playhead backwards. */
  const loadingRef = useRef(0);
  /** Same guard for a seek. The engine samples its playhead four times a
   * second, so between asking it to move and it having moved there is always a
   * tick describing where the playhead *was* — which snapped the thumb back to
   * where it was dropped. */
  const seekingRef = useRef(0);
  /** The length of the playing track, for the preload check that runs on every
   * status tick and must not re-subscribe four times a second to read it. */
  const durationRef = useRef(0);
  durationRef.current = duration;
  /** The track already handed to the engine to play next, or null. Cleared by
   * every load, which drops the engine's queue along with whatever was in it. */
  const preloadedRef = useRef<PlayableTrack | null>(null);

  const reportFailure = useReportPlaybackFailure();

  /** Take a track as the playing one, without touching the engine.
   *
   * Everything a launch does apart from the load itself, because the gapless
   * hand-over is exactly that: the engine is already playing the file, and
   * loading it again would put back the gap the hand-over exists to avoid. */
  const adopt = useCallback((track: PlayableTrack, decoded?: number | null) => {
    setCurrent(track);
    setCurrentTime(0);
    setDuration(decoded ?? track.duration ?? 0);
    setIsPlaying(true);

    // Tell the OS what this is: media keys, Control Center, the lock screen.
    // Sent alongside the load rather than from it — the engine is handed a file
    // path, and none of this is the engine's business.
    void engine.setNowPlaying({
      title: track.title,
      artist: track.subtitle,
      artPath: track.artPath,
      duration: track.duration,
    });
  }, []);

  /** Hand a track to the engine and start it. The one path every launch, skip
   * and auto-advance goes through.
   *
   * The state moves before the round-trip so the UI answers the click at once;
   * the engine's own decoded duration replaces the library's when it lands,
   * and it is the more accurate of the two. */
  const loadTrack = useCallback(
    (track: PlayableTrack) => {
      adopt(track);
      preloadedRef.current = null;

      const token = loadingRef.current + 1;
      loadingRef.current = token;
      void engine.load(track.path).then(
        (decoded) => {
          // A newer load overtook this one — its duration is the one that counts.
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

  /** Move the playhead. Set locally first so the thumb lands where it was
   * dropped instead of snapping back until the next status tick, and hold the
   * engine's own ticks off until it confirms — the one in flight is stale by
   * definition. */
  const seek = useCallback((time: number) => {
    setCurrentTime(time);
    const token = seekingRef.current + 1;
    seekingRef.current = token;
    void engine.seek(time).finally(() => {
      // A newer seek is already in charge; this one has nothing left to release.
      if (seekingRef.current === token) seekingRef.current = 0;
    });
  }, []);

  /** Apply a queue transition and make playback follow it. A transition that
   * lands on the already-loaded track restarts it rather than reloading. */
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

  /** Hand the engine the next file before the playing one runs out, so it can
   * cross over without stopping to open a decoder — the gap reassigning
   * `<audio>.src` could never close.
   *
   * Near the end rather than at the start of the track: what comes next is only
   * settled once the queue has stopped moving, and a shuffle toggled after the
   * file was lined up would be heard as the wrong song. */
  const preloadNext = useCallback((position: number) => {
    if (preloadedRef.current) return;
    const total = durationRef.current;
    if (!total || total - position > PRELOAD_LEAD) return;

    const nextState = queueAfterEnded(queueRef.current);
    const track = nextState && currentTrack(nextState);
    if (!track) return;
    preloadedRef.current = track;
    void engine.enqueue(track.path).catch(() => {
      // Unreadable. Stay quiet here and let the track run out: the ordinary
      // path re-opens the same file through `loadTrack`, which is where the
      // failure gets said. Speaking now would say it eight seconds early, about
      // a track the user is not listening to yet.
      if (preloadedRef.current === track) preloadedRef.current = null;
    });
  }, []);

  // Follow the engine, the external system that owns playback. It reports four
  // times a second while something plays and goes quiet otherwise.
  useEffect(() => {
    const unlisten = engine.onStatus((status) => {
      // Ignore ticks that describe the track we are leaving, or the playhead we
      // are in the middle of moving.
      if (status.loaded && !seekingRef.current) setCurrentTime(status.position);
      setIsPlaying(status.isPlaying);
      if (status.loaded) preloadNext(status.position);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [preloadNext]);

  // The engine crossed into the file it was handed ahead of time. Nothing
  // stopped, so there is nothing to load: only the queue and the display have
  // to catch up with what is already being heard.
  useEffect(() => {
    const unlisten = engine.onAdvanced(({ path, duration: decoded }) => {
      preloadedRef.current = null;
      const nextState = queueAfterEnded(queueRef.current);
      const track = nextState && currentTrack(nextState);
      if (!nextState || !track) {
        // The queue no longer has anywhere to go — repeat turned off at the
        // last track, say. Silence beats playing a track nothing points at.
        void engine.stop();
        setIsPlaying(false);
        return;
      }
      setQueue(nextState);
      // The queue moved after the file was lined up. Reloading costs the gap
      // this whole path exists to avoid, and is still better than showing one
      // track while playing another.
      if (track.path === path) adopt(track, decoded);
      else loadTrack(track);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [adopt, loadTrack]);

  // The engine ran out of audio: the queue decides what happens next.
  useEffect(() => {
    const unlisten = engine.onEnded(() => {
      const nextState = queueAfterEnded(queueRef.current);
      if (!nextState) {
        // Nothing follows. The queue survives so the panel still shows what
        // just played, and the playhead is left where it stopped rather than
        // rewound — the engine has gone quiet, so no tick will move it.
        setIsPlaying(false);
        return;
      }
      applyQueue(nextState);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [applyQueue]);

  /** Play/pause without a round-trip for the answer: the engine reports the
   * truth 250 ms later, and a transport button must not wait for it. */
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
      // Clicking the playing track toggles it; the queue it came from stays.
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
      // Same toggle guard as `play`: "play all" on the already-playing opener
      // reads as pause/resume, not as a restart.
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
      // No toggle guard on purpose — even landing on the playing track by
      // chance, the press asked for a relaunch.
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
    // Past the threshold — or already at the front: start the track over.
    seek(0);
  }, [applyQueue, seek]);

  /** `value` is the slider position, 0…1. The engine turns it into an
   * amplitude — the taper lives there, so every caller gets the same curve. */
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

  // A press on a media key, the Control Center or the lock screen. It lands on
  // the same callbacks the on-screen transport uses, so there is exactly one
  // definition of what "next" means.
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
        // play/pause/toggle all land here: the OS sends whichever its own
        // button says, and the engine already knows which way it is going.
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

/** Output level. Call this from the control that draws it, never from a parent
 * that merely renders one — a drag would take the parent's subtree with it. */
export function usePlayerVolume(): PlayerVolume {
  const ctx = useContext(VolumeContext);
  if (!ctx) throw new Error("usePlayerVolume must be used within a PlayerProvider");
  return ctx;
}
