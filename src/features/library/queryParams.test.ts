import { describe, expect, it } from "vitest";

import { searchWith, withParam } from "@/features/library/queryParams";

describe("withParam", () => {
  it("sets a param and keeps the others", () => {
    const params = new URLSearchParams("view=tracks&family=Rock");
    expect(withParam(params, "genre", "Grunge").toString()).toBe("view=tracks&family=Rock&genre=Grunge");
  });

  it("clears a param on null rather than writing it empty", () => {
    const params = new URLSearchParams("view=tracks&genre=Grunge");
    expect(withParam(params, "genre", null).toString()).toBe("view=tracks");
  });

  it("leaves the params it was given untouched", () => {
    const params = new URLSearchParams("view=tracks");
    withParam(params, "view", null);
    expect(params.toString()).toBe("view=tracks");
  });
});

describe("searchWith", () => {
  it("prefixes a question mark when something is left", () => {
    // The regression this exists for: a sub-genre chip built its URL from its own
    // value alone, so flipping one in the tracks mode reset the page's mode.
    expect(searchWith(new URLSearchParams("view=tracks"), "genre", "Grunge")).toBe("?view=tracks&genre=Grunge");
  });

  it("returns an empty search when the last param is cleared", () => {
    expect(searchWith(new URLSearchParams("genre=Grunge"), "genre", null)).toBe("");
  });
});
