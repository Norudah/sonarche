import { describe, expect, it } from "vitest";

import type { ScanReport } from "@/features/import/api";
import { CROWDED_FOLDER, isSuggestionNotable, suggestGrouping } from "@/features/import/grouping";

function report(largestFolder: number): ScanReport {
  return {
    playable: largestFolder,
    unplayable: 0,
    unplayableByExtension: {},
    unplayableExamples: [],
    albumFolders: 1,
    largestFolder,
    bytes: 0,
    truncated: false,
  };
}

describe("suggestGrouping", () => {
  /** The case the whole mode exists for: a folder holding more tracks than any
   * release does is a pile, and beets would file it as one album. */
  it("suggests standalone tracks for a folder nobody could call a record", () => {
    expect(suggestGrouping(report(200))).toBe("tracks");
    expect(isSuggestionNotable(report(200))).toBe(true);
  });

  /** A double album runs to about thirty tracks and a box set further — the
   * threshold is generous on purpose, and equality is not over it. */
  it("leaves a long record alone", () => {
    expect(suggestGrouping(report(CROWDED_FOLDER))).toBe("folder");
    expect(suggestGrouping(report(12))).toBe("folder");
    expect(isSuggestionNotable(report(12))).toBe(false);
  });

  it("says nothing about an empty folder", () => {
    expect(suggestGrouping(report(0))).toBe("folder");
  });
});
