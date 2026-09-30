import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "@/shared/lib/format";

describe("formatDuration", () => {
  it("always pads the seconds to two digits", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("rounds to the nearest second rather than truncating", () => {
    expect(formatDuration(59.6)).toBe("1:00");
    expect(formatDuration(178.4)).toBe("2:58");
  });

  it("keeps counting in minutes past the hour", () => {
    // No hour segment by design: a track long enough to need one is an outlier.
    expect(formatDuration(3600)).toBe("60:00");
  });
});

describe("formatBytes", () => {
  it("climbs the units until the number is readable", () => {
    expect(formatBytes(512, "en")).toBe("512 B");
    expect(formatBytes(4_200, "en")).toBe("4 kB");
    expect(formatBytes(31_400_000_000, "en")).toBe("31.4 GB");
  });

  it("keeps a decimal only where it means something", () => {
    // Half a kilobyte of difference in a 4 kB file is noise.
    expect(formatBytes(4_500, "en")).toBe("5 kB");
    // Half a gigabyte is not.
    expect(formatBytes(4_500_000_000, "en")).toBe("4.5 GB");
    // Past a hundred, the decimal stops earning its place again.
    expect(formatBytes(450_000_000_000, "en")).toBe("450 GB");
  });

  it("follows the interface language, number and unit both", () => {
    // The decimal comma is Intl's; the "Go" is the caller's, because a French
    // gigabyte is not spelled the English way.
    expect(formatBytes(31_400_000_000, "fr", ["o", "ko", "Mo", "Go", "To"])).toBe("31,4 Go");
  });

  it("falls back to SI symbols when no unit names are given", () => {
    expect(formatBytes(31_400_000_000, "fr")).toBe("31,4 GB");
  });

  it("does not go below zero", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(-1, "en")).toBe("0 B");
  });
});
