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

  /** Unknown values (older builds, hand edits) keep the default. */
  it("treats anything it does not recognise as on", () => {
    expect(parseLaunchWelcome("")).toBe(true);
    expect(parseLaunchWelcome("false")).toBe(true);
    expect(parseLaunchWelcome("OFF")).toBe(true);
  });
});
