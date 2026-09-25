import type { PlayableTrack } from "@/shared/player/types";

export type RepeatMode = "off" | "all" | "one";

/** The queue as pure data. `tracks` keeps the context's order; shuffle only
 * permutes `order`, so turning it off restores the original sequence. */
export interface QueueState {
  tracks: PlayableTrack[];
  /** Indices into `tracks`; identity when shuffle is off. */
  order: number[];
  /** Index in `order` of the playing track; -1 when empty. */
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

/** Fisher-Yates: one draw for the whole set avoids repeats. */
function permutation(count: number, random: () => number): number[] {
  const order = identityOrder(count);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The playing track stays first, so enabling shuffle doesn't interrupt it. */
export function shuffledOrder(count: number, firstIndex: number, random: () => number = Math.random): number[] {
  const order = permutation(count, random);
  const at = order.indexOf(firstIndex);
  if (at > 0) {
    order.splice(at, 1);
    order.unshift(firstIndex);
  }
  return order;
}

/** Shuffle and repeat are modes that survive a new launch. */
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

/** Enabling draws a new permutation from the playing track; disabling
 * restores the original order at its position. */
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

/** "Play all": forces sequential order. */
export function startQueueOrdered(state: QueueState, tracks: PlayableTrack[], startIndex = 0): QueueState {
  return startQueue({ ...state, isShuffled: false }, tracks, startIndex);
}

/** "Shuffle": forces shuffle with a random opener, drawn fresh each press. */
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

/** After a natural end. `null` means stop (position and queue are kept);
 * repeat-one returns the state unchanged for the caller to restart. */
export function queueAfterEnded(state: QueueState): QueueState | null {
  if (state.position < 0) return null;
  if (state.repeat === "one") return state;
  return queueAfterNext(state);
}

/** An explicit "next" ignores repeat-one, the only way out of the loop. */
export function queueAfterNext(state: QueueState): QueueState | null {
  if (state.position < 0) return null;
  if (state.position + 1 < state.order.length) return { ...state, position: state.position + 1 };
  if (state.repeat === "all") return { ...state, position: 0 };
  return null;
}

/** `null` at the front: the caller restarts the current track. */
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

/** Tracks in actual play order. */
export function playOrder(state: QueueState): PlayableTrack[] {
  return state.order.map((index) => state.tracks[index]);
}
