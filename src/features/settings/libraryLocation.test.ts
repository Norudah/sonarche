import { describe, expect, it } from "vitest";

import { formatBytes, shortenPath } from "@/features/settings/libraryLocation";

describe("formatBytes", () => {
  it("climbs the units in thousands, the way a disk is sold", () => {
    expect(formatBytes(0, "fr")).toBe("0 o");
    expect(formatBytes(999, "fr")).toBe("999 o");
    expect(formatBytes(1000, "fr")).toBe("1 ko");
    expect(formatBytes(1_500_000, "fr")).toBe("2 Mo");
  });

  it("keeps a decimal from a gigabyte up, where a tenth is worth 100 Mo", () => {
    expect(formatBytes(68_400_000_000, "fr")).toBe("68,4 Go");
    expect(formatBytes(68_400_000_000, "en")).toBe("68.4 Go");
  });

  it("stops at terabytes rather than inventing a unit", () => {
    expect(formatBytes(5_000_000_000_000_000, "en")).toBe("5,000 To");
  });
});

describe("shortenPath", () => {
  it("keeps a short path whole", () => {
    expect(shortenPath("/Music/Sonarche")).toBe("/Music/Sonarche");
  });

  it("keeps the last two segments of a deep one", () => {
    expect(shortenPath("/Users/romain/Library/Mobile Documents/Music/Sonarche")).toBe("…/Music/Sonarche");
  });

  it("reads a Windows path the same way", () => {
    expect(shortenPath("C:\\Users\\romain\\Music\\Sonarche")).toBe("…/Music/Sonarche");
  });
});
