import { describe, expect, it } from "vitest";

import type { ScanReport } from "@/features/import/api";
import { hasAudio, shortenPath, unplayableFormats } from "@/features/import/summary";

function report(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    playable: 0,
    unplayable: 0,
    unplayableByExtension: {},
    unplayableExamples: [],
    albumFolders: 0,
    largestFolder: 0,
    bytes: 0,
    truncated: false,
    ...overrides,
  };
}

describe("unplayableFormats", () => {
  it("puts the most common format first", () => {
    const formats = unplayableFormats(report({ unplayableByExtension: { opus: 2, wma: 40 } }));

    expect(formats).toEqual([".wma", ".opus"]);
  });

  it("breaks a tie alphabetically, so the same folder reads the same twice", () => {
    const formats = unplayableFormats(report({ unplayableByExtension: { wma: 3, ape: 3 } }));

    expect(formats).toEqual([".ape", ".wma"]);
  });

  it("says nothing when there is nothing to say", () => {
    expect(unplayableFormats(report())).toEqual([]);
  });
});

describe("hasAudio", () => {
  it("counts what cannot be played as something to import", () => {
    expect(hasAudio(report({ unplayable: 3 }))).toBe(true);
    expect(hasAudio(report({ playable: 1 }))).toBe(true);
  });

  it("is false for a folder with no music in it", () => {
    expect(hasAudio(report())).toBe(false);
  });
});

describe("shortenPath", () => {
  it("leaves a short path alone", () => {
    expect(shortenPath("/Users/romain/Music")).toBe("/Users/romain/Music");
  });

  it("cuts the middle, keeping the volume and the folder", () => {
    const short = shortenPath("/Volumes/Backup/archive/2011/music/rips/FLAC");

    expect(short).toBe("/Volumes/…/music/rips/FLAC");
  });

  it("cuts a Windows path too, and spells it back with backslashes", () => {
    // Split on "/" alone this was a single segment: always under the ceiling,
    // so a Windows path was never shortened and overflowed its one line.
    const short = shortenPath("C:\\Users\\pieru\\Music\\archive\\rips\\FLAC");

    expect(short).toBe("C:\\…\\archive\\rips\\FLAC");
  });

  it("does not put a leading separator in front of a drive letter", () => {
    expect(shortenPath("C:\\a\\b\\c\\d\\e")).not.toMatch(/^[/\\]/);
  });
});
