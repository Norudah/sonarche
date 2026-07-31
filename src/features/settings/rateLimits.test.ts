import { describe, expect, it } from "vitest";

import { formatDelay, formatDuration, marksFor, nearestStopIndex, stopsFor } from "@/features/settings/rateLimits";

describe("stopsFor", () => {
  it("runs in quarter seconds up to two", () => {
    expect(stopsFor(2)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  });

  it("switches to whole seconds past two", () => {
    expect(stopsFor(5)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 5]);
  });

  /** The reason the values are rounded on the way out: eight additions of 0.25
   * land on 1.9999999999999998, which then matches no stored value. */
  it("holds exact values rather than float noise", () => {
    expect(stopsFor(15)).toContain(2);
    expect(stopsFor(15).every((value) => Number.isInteger(value * 100))).toBe(true);
  });

  it("always ends on the max, whole or not", () => {
    expect(stopsFor(1.5).at(-1)).toBe(1.5);
    expect(stopsFor(15).at(-1)).toBe(15);
    expect(stopsFor(2).at(-1)).toBe(2);
  });

  /** Half the point of the scale: most of the rail goes to the first two
   * seconds, which is the region where the setting changes anything. */
  it("spends more than a third of a fifteen-second rail under two seconds", () => {
    const stops = stopsFor(15);
    const underTwo = stops.filter((value) => value <= 2).length;
    expect(underTwo / stops.length).toBeGreaterThan(0.35);
  });
});

describe("nearestStopIndex", () => {
  const stops = stopsFor(15);

  it("finds an exact stop", () => {
    expect(stops[nearestStopIndex(stops, 1.25)]).toBe(1.25);
    expect(stops[nearestStopIndex(stops, 3)]).toBe(3);
  });

  /** A value stored by an older build, or one the backend clamped: the slider
   * still has to show a position rather than fall back to zero. */
  it("snaps a value that sits between two stops", () => {
    expect(stops[nearestStopIndex(stops, 0.4)]).toBe(0.5);
    expect(stops[nearestStopIndex(stops, 2.6)]).toBe(3);
  });

  it("clamps past either end", () => {
    expect(nearestStopIndex(stops, -5)).toBe(0);
    expect(nearestStopIndex(stops, 99)).toBe(stops.length - 1);
  });
});

describe("marksFor", () => {
  it("prints the ends, the polite floor and the two-second hinge", () => {
    expect(marksFor(15).map((mark) => mark.value)).toEqual([0, 1, 2, 5, 10, 15]);
    expect(marksFor(2).map((mark) => mark.value)).toEqual([0, 1, 2]);
  });

  it("adds the max when it is not a round number", () => {
    expect(marksFor(1.5).map((mark) => mark.value)).toEqual([0, 1, 1.5]);
  });

  /**
   * The marks are positioned from stop indexes, not from seconds. On the
   * fifteen-second scale that puts "1 s" almost a fifth of the way along a rail
   * it would otherwise sit at 7% of — which is exactly the lie an evenly-spaced
   * label row told about a non-linear track.
   */
  it("positions a mark by its stop, not by its value", () => {
    const marks = marksFor(15);
    expect(marks[0].position).toBe(0);
    expect(marks.at(-1)!.position).toBe(100);

    const oneSecond = marks.find((mark) => mark.value === 1)!;
    expect(oneSecond.position).toBeGreaterThan(15);
    expect(oneSecond.position).toBeLessThan(25);
  });
});

describe("formatDelay", () => {
  it("names zero rather than printing it", () => {
    expect(formatDelay(0, "fr", "Instantané")).toBe("Instantané");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatDelay(1.25, "fr", "Instantané")).toBe("1,25 s");
    expect(formatDelay(1.25, "en", "Instant")).toBe("1.25 s");
  });

  it("drops trailing zeros on a whole value", () => {
    expect(formatDelay(3, "fr", "Instantané")).toBe("3 s");
  });
});

describe("formatDuration", () => {
  it("stays in seconds below a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(59.4)).toBe("59s");
  });

  it("drops the seconds when the count is whole minutes", () => {
    expect(formatDuration(60)).toBe("1min");
    expect(formatDuration(300)).toBe("5min");
  });

  it("prints both parts otherwise", () => {
    expect(formatDuration(90)).toBe("1min 30s");
    expect(formatDuration(3661)).toBe("61min 1s");
  });

  it("rounds before splitting, so 59.6s reads as a minute", () => {
    expect(formatDuration(59.6)).toBe("1min");
  });
});
