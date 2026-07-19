import { describe, expect, it } from "vitest";

import { formatDuration, marksFor, RATE_LIMITS } from "@/features/settings/rateLimits";

const limit = (key: string) => RATE_LIMITS.find((def) => def.key === key)!;

describe("marksFor", () => {
  it("prints an inclusive scale from min to max", () => {
    expect(marksFor(limit("download"))).toEqual([0, 3, 6, 9, 12, 15]);
  });

  it("survives fractional steps without drifting off the max", () => {
    // 0.25-based ranges are where a naive loop accumulates float error and
    // overshoots or drops the last mark.
    expect(marksFor(limit("acoustid"))).toEqual([0, 0.5, 1, 1.5, 2]);

    const lastfm = marksFor(limit("lastfm"));
    expect(lastfm.at(0)).toBe(0);
    expect(lastfm.at(-1)).toBeCloseTo(1.5);
    expect(lastfm).toHaveLength(7);
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
