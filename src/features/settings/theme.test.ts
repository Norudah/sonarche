import { describe, expect, it } from "vitest";

import { parsePreference, resolveTheme } from "@/features/settings/theme";

describe("parsePreference", () => {
  it("keeps the three known values", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
  });

  /** Nothing stored yet — the first launch, and the common case. */
  it("falls back to system when nothing is stored", () => {
    expect(parsePreference(null)).toBe("system");
  });

  /** A value from a future build, a half-written entry, someone editing storage
   * by hand: none of them should pin the app to a theme it cannot name. */
  it("falls back to system on an unknown value", () => {
    expect(parsePreference("solarized")).toBe("system");
    expect(parsePreference("")).toBe("system");
    expect(parsePreference("Dark")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("returns an explicit choice whatever the OS says", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS when the choice is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
