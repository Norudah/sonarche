import { describe, expect, it } from "vitest";

import { trackDuration } from "@/shared/player/duration";

describe("trackDuration", () => {
  it("takes the library's length, which is the file's own", () => {
    expect(trackDuration(259.1, 259.088)).toBe(259.1);
  });

  it("ignores the element reporting about double", () => {
    // The regression this exists for: read through the asset protocol, the
    // element's figure came out doubled and the bar reached the end of the
    // music at its halfway mark.
    expect(trackDuration(259.1, 518.2)).toBe(259.1);
  });

  it("falls back to the element when the library has no length", () => {
    expect(trackDuration(null, 259.088)).toBe(259.088);
  });

  it("treats a zero library length as no length", () => {
    expect(trackDuration(0, 259.088)).toBe(259.088);
  });

  it("holds nothing before the element knows anything", () => {
    expect(trackDuration(null, NaN)).toBeNull();
  });

  it("rejects a stream of unknown length", () => {
    expect(trackDuration(null, Infinity)).toBeNull();
  });
});
