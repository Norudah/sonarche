import type { PlayableTrack } from "@/shared/player/types";

export type RepeatMode = "off" | "all" | "one";

/**
 * The playback queue as pure data. `tracks` is the launched set in its
 * context's own order — an album's tracklist, the explorer's filtered list —
 * and `order` is the order it actually plays in, as indices into `tracks`.
 * Shuffle never touches `tracks`: it swaps `order` for a permutation, so
 * turning it off recovers the original sequence exactly.
 */
export interface QueueState {
  tracks: PlayableTrack[];
  /** Play order, as indices into `tracks`. Identity when shuffle is off. */
  order: number[];
  /** Position in `order` of the playing track; -1 when the queue is empty. */
  position: number;
  isShuffled: boolean;
  repeat: RepeatMode;
}

export function emptyQueue(): QueueState {
  return { tracks: [], order: [], position: -1, isShuffled: false, repeat: "off" };
}

function identityOrder(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/** Fisher-Yates permutation — one draw for the whole set, not a fresh draw per
 * skip, which is what produces repeats before the set is exhausted. */
function permutation(count: number, random: () => number): number[] {
  const order = identityOrder(count);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** A full permutation with `firstIndex` moved to the front: the playing track
 * leads, so enabling shuffle never interrupts it. */
export function shuffledOrder(count: number, firstIndex: number, random: () => number = Math.random): number[] {
  const order = permutation(count, random);
  const at = order.indexOf(firstIndex);
  if (at > 0) {
    order.splice(at, 1);
    order.unshift(firstIndex);
  }
  return order;
}

/** Launch a new set. Shuffle and repeat are modes, not launch options: they
 * survive the launch, so a shuffled listener stays shuffled across albums. */
export function startQueue(
  state: QueueState,
  tracks: PlayableTrack[],
  startIndex: number,
  random: () => number = Math.random,
): QueueState {
  if (tracks.length === 0) return { ...state, tracks: [], order: [], position: -1 };
  return {
    ...state,
    tracks,
    order: state.isShuffled ? shuffledOrder(tracks.length, startIndex, random) : identityOrder(tracks.length),
    position: state.isShuffled ? 0 : startIndex,
  };
}

/**
 * Enabling re-shuffles from the playing track; disabling returns to the
 * original order at the playing track's own position. Each enable draws a new
 * permutation — replaying yesterday's "random" order is what users report as
 * a broken shuffle.
 */
export function toggleShuffle(state: QueueState, random: () => number = Math.random): QueueState {
  if (state.position < 0) return { ...state, isShuffled: !state.isShuffled };
  const trackIndex = state.order[state.position];
  if (state.isShuffled) {
    return { ...state, isShuffled: false, order: identityOrder(state.tracks.length), position: trackIndex };
  }
  return {
    ...state,
    isShuffled: true,
    order: shuffledOrder(state.tracks.length, trackIndex, random),
    position: 0,
  };
}

/** A "play all" press. Forces sequential order — the button states the mode,
 * unlike a row click which plays within whatever mode is active. */
export function startQueueOrdered(state: QueueState, tracks: PlayableTrack[], startIndex = 0): QueueState {
  return startQueue({ ...state, isShuffled: false }, tracks, startIndex);
}

/**
 * A "shuffle" press. Forces shuffle on with no forced opener — unlike
 * `startQueue` under an active shuffle, nothing here was clicked, and a
 * surprise first track is the whole point. Each press draws fresh.
 */
export function startQueueShuffled(
  state: QueueState,
  tracks: PlayableTrack[],
  random: () => number = Math.random,
): QueueState {
  if (tracks.length === 0) return { ...state, isShuffled: true, tracks: [], order: [], position: -1 };
  return { ...state, isShuffled: true, tracks, order: permutation(tracks.length, random), position: 0 };
}

export function cycleRepeat(state: QueueState): QueueState {
  const next: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };
  return { ...state, repeat: next[state.repeat] };
}

/**
 * Where the queue goes when a track ends on its own. `null` means stop: the
 * position stays on the last track and the queue survives, so the panel still
 * shows what just played. Repeat-one returns the state unchanged — the caller
 * restarts the same track.
 */
export function queueAfterEnded(state: QueueState): QueueState | null {
  if (state.position < 0) return null;
  if (state.repeat === "one") return state;
  return queueAfterNext(state);
}

/** An explicit "next" press. Deliberately ignores repeat-one: skipping past a
 * looping track is the one way out of the loop. */
export function queueAfterNext(state: QueueState): QueueState | null {
  if (state.position < 0) return null;
  if (state.position + 1 < state.order.length) return { ...state, position: state.position + 1 };
  if (state.repeat === "all") return { ...state, position: 0 };
  return null;
}

/** Step back one slot. `null` at the front — the caller restarts the current
 * track instead (the universal "previous at the first track" behavior). */
export function queueAfterPrevious(state: QueueState): QueueState | null {
  if (state.position <= 0) return null;
  return { ...state, position: state.position - 1 };
}

export function jumpTo(state: QueueState, position: number): QueueState {
  if (position < 0 || position >= state.order.length) return state;
  return { ...state, position };
}

export function currentTrack(state: QueueState): PlayableTrack | null {
  if (state.position < 0) return null;
  return state.tracks[state.order[state.position]] ?? null;
}

/** The effective play order — what the panel displays. Honest under shuffle:
 * rows come out in the order they will actually be heard. */
export function playOrder(state: QueueState): PlayableTrack[] {
  return state.order.map((index) => state.tracks[index]);
}
