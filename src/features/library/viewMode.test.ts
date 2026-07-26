import { describe, expect, it } from "vitest";

import { parseViewMode, withViewMode } from "@/features/library/viewMode";

describe("parseViewMode", () => {
  it("defaults to the overview", () => {
    expect(parseViewMode(new URLSearchParams(""))).toBe("overview");
    expect(parseViewMode(new URLSearchParams("view=grid"))).toBe("overview");
    expect(parseViewMode(new URLSearchParams("genre=Grunge"))).toBe("overview");
  });

  it("reads the tracks mode", () => {
    expect(parseViewMode(new URLSearchParams("view=tracks"))).toBe("tracks");
  });
});

describe("withViewMode", () => {
  it("carries the page's other params through the switch", () => {
    const params = new URLSearchParams("genre=Grunge");
    expect(withViewMode(params, "tracks").toString()).toBe("genre=Grunge&view=tracks");
  });

  it("drops the param for the default rather than spelling it out", () => {
    expect(withViewMode(new URLSearchParams("genre=Grunge&view=tracks"), "overview").toString()).toBe("genre=Grunge");
  });

  it("leaves the params it was given untouched", () => {
    const params = new URLSearchParams("view=tracks");
    withViewMode(params, "overview");
    expect(params.toString()).toBe("view=tracks");
  });
});
