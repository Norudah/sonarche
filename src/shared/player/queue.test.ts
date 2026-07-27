import { describe, expect, it } from "vitest";

import {
  currentTrack,
  cycleRepeat,
  emptyQueue,
  jumpTo,
  playOrder,
  queueAfterEnded,
  queueAfterNext,
  queueAfterPrevious,
  shuffledOrder,
  startQueue,
  startQueueOrdered,
  startQueueShuffled,
  toggleShuffle,
  type QueueState,
} from "@/shared/player/queue";
import type { PlayableTrack } from "@/shared/player/types";

function tracksOf(count: number): PlayableTrack[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, path: `/music/file-${i}.m4a`, title: `Track ${i}` }));
}

/** Deterministic stand-in for Math.random. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function queueOf(count: number, startIndex = 0): QueueState {
  return startQueue(emptyQueue(), tracksOf(count), startIndex);
}

describe("shuffledOrder", () => {
  it("is a complete permutation with the given index first", () => {
    const order = shuffledOrder(10, 4, seeded(7));
    expect(order[0]).toBe(4);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("handles the single-track queue", () => {
    expect(shuffledOrder(1, 0, seeded(1))).toEqual([0]);
  });
});

describe("startQueue", () => {
  it("plays sequentially from the clicked track", () => {
    const state = queueOf(5, 2);
    expect(state.position).toBe(2);
    expect(currentTrack(state)?.id).toBe(2);
    expect(state.order).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps shuffle across launches, clicked track first", () => {
    const shuffled = toggleShuffle(queueOf(5), seeded(3));
    const relaunched = startQueue(shuffled, tracksOf(8), 6, seeded(9));
    expect(relaunched.isShuffled).toBe(true);
    expect(relaunched.position).toBe(0);
    expect(currentTrack(relaunched)?.id).toBe(6);
    expect([...relaunched.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("empties cleanly", () => {
    const state = startQueue(queueOf(3), [], 0);
    expect(state.position).toBe(-1);
    expect(currentTrack(state)).toBeNull();
  });
});

describe("startQueueOrdered", () => {
  it("forces sequential order even under an active shuffle mode", () => {
    const shuffled = toggleShuffle(queueOf(5), seeded(3));
    const state = startQueueOrdered(shuffled, tracksOf(5));
    expect(state.isShuffled).toBe(false);
    expect(state.order).toEqual([0, 1, 2, 3, 4]);
    expect(state.position).toBe(0);
  });
});

describe("startQueueShuffled", () => {
  it("draws a complete permutation with no forced opener", () => {
    const state = startQueueShuffled(queueOf(8), tracksOf(8), seeded(4));
    expect(state.isShuffled).toBe(true);
    expect(state.position).toBe(0);
    expect([...state.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the shuffle flag on an empty set", () => {
    const state = startQueueShuffled(emptyQueue(), [], seeded(1));
    expect(state.isShuffled).toBe(true);
    expect(state.position).toBe(-1);
  });
});

describe("toggleShuffle", () => {
  it("keeps the playing track and returns to original order on disable", () => {
    const playing = jumpTo(queueOf(10), 6);
    const shuffled = toggleShuffle(playing, seeded(5));
    expect(shuffled.isShuffled).toBe(true);
    expect(currentTrack(shuffled)?.id).toBe(6);

    const advanced = queueAfterNext(shuffled);
    expect(advanced).not.toBeNull();
    const unshuffled = toggleShuffle(advanced as QueueState);
    expect(unshuffled.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(currentTrack(unshuffled)?.id).toBe(currentTrack(advanced as QueueState)?.id);
  });

  it("only flips the flag on an empty queue", () => {
    const state = toggleShuffle(emptyQueue(), seeded(1));
    expect(state.isShuffled).toBe(true);
    expect(state.position).toBe(-1);
  });
});

describe("cycleRepeat", () => {
  it("cycles off → all → one → off", () => {
    const state = queueOf(2);
    const all = cycleRepeat(state);
    const one = cycleRepeat(all);
    const off = cycleRepeat(one);
    expect([all.repeat, one.repeat, off.repeat]).toEqual(["all", "one", "off"]);
  });
});

describe("queueAfterEnded", () => {
  it("advances to the next slot", () => {
    const state = queueAfterEnded(queueOf(3));
    expect(state?.position).toBe(1);
  });

  it("stops at the end without repeat, keeping the queue", () => {
    expect(queueAfterEnded(jumpTo(queueOf(3), 2))).toBeNull();
  });

  it("wraps at the end with repeat all", () => {
    const state = queueAfterEnded(cycleRepeat(jumpTo(queueOf(3), 2)));
    expect(state?.position).toBe(0);
  });

  it("stays put with repeat one", () => {
    const looping = cycleRepeat(cycleRepeat(jumpTo(queueOf(3), 1)));
    const state = queueAfterEnded(looping);
    expect(state?.position).toBe(1);
  });
});

describe("queueAfterNext", () => {
  it("escapes a repeat-one loop", () => {
    const looping = cycleRepeat(cycleRepeat(queueOf(3)));
    const state = queueAfterNext(looping);
    expect(state?.position).toBe(1);
  });

  it("is a no-op at the end without repeat", () => {
    expect(queueAfterNext(jumpTo(queueOf(3), 2))).toBeNull();
  });
});

describe("queueAfterPrevious", () => {
  it("steps back one slot", () => {
    const state = queueAfterPrevious(jumpTo(queueOf(3), 2));
    expect(state?.position).toBe(1);
  });

  it("returns null at the front so the caller restarts the track", () => {
    expect(queueAfterPrevious(queueOf(3))).toBeNull();
  });
});

describe("jumpTo / playOrder", () => {
  it("jumps within bounds and ignores out-of-range targets", () => {
    const state = queueOf(4);
    expect(jumpTo(state, 3).position).toBe(3);
    expect(jumpTo(state, 4).position).toBe(0);
    expect(jumpTo(state, -1).position).toBe(0);
  });

  it("playOrder follows the shuffled order", () => {
    const shuffled = toggleShuffle(queueOf(5), seeded(11));
    const ids = playOrder(shuffled).map((track) => track.id);
    expect(ids).toEqual(shuffled.order);
  });
});
