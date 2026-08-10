import { describe, expect, it } from "vitest";

import { CHECK_KEYS, enabledLines, parseDisabled } from "@/features/library/triage/enabledChecks";
import type { TriageLine } from "@/features/library/triage/queue";

const line = (key: TriageLine["key"]): TriageLine => ({
  key,
  count: 1,
  doors: [],
  examples: [],
  subjects: [],
  accept: null,
});

describe("parseDisabled", () => {
  it("reads the stored list", () => {
    expect(parseDisabled("year,genre")).toEqual(["year", "genre"]);
    expect(parseDisabled(" year , genre ")).toEqual(["year", "genre"]);
  });

  it("watches everything until something is stored", () => {
    expect(parseDisabled(null)).toEqual([]);
    expect(parseDisabled("")).toEqual([]);
  });

  /** A key from an older build must not survive as a line that is silently
   * never raised again. */
  it("ignores a key that is not a check we know", () => {
    expect(parseDisabled("year,bitrate,genre")).toEqual(["year", "genre"]);
    expect(parseDisabled("nonsense")).toEqual([]);
  });
});

describe("enabledLines", () => {
  const queue = CHECK_KEYS.map(line);

  it("hands the queue back untouched when nothing is off", () => {
    expect(enabledLines(queue, [])).toBe(queue);
  });

  it("drops only what was switched off", () => {
    expect(enabledLines(queue, ["year", "artwork"]).map((entry) => entry.key)).toEqual([
      "suspect",
      "duplicates",
      "genre",
      "tracklist",
    ]);
  });
});
