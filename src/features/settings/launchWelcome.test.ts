import { describe, expect, it } from "vitest";

import { parseLaunchWelcome } from "@/features/settings/launchWelcome";

describe("parseLaunchWelcome", () => {
  it("is on until somebody turns it off", () => {
    expect(parseLaunchWelcome(null)).toBe(true);
    expect(parseLaunchWelcome(undefined)).toBe(true);
    expect(parseLaunchWelcome("on")).toBe(true);
  });

  it("is off only on the exact stored word", () => {
    expect(parseLaunchWelcome("off")).toBe(false);
  });

  /**
   * The default has to survive a value we do not recognise — a key written by
   * an older build, or by hand. Falling back to "off" would silently retire a
   * feature nobody asked to retire.
   */
  it("treats anything it does not recognise as on", () => {
    expect(parseLaunchWelcome("")).toBe(true);
    expect(parseLaunchWelcome("false")).toBe(true);
    expect(parseLaunchWelcome("OFF")).toBe(true);
  });
});
