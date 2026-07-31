import { describe, expect, it } from "vitest";

import { phaseFor } from "@/features/onboarding/splashPhase";

describe("phaseFor", () => {
  it("welcomes someone whose environment was already in place", () => {
    expect(phaseFor("checking", "ready")).toBe("welcome");
  });

  /** The one that has to be different: this person just spent a minute
   * installing an engine, and "welcome" would ignore what they did. */
  it("sends off someone who has just finished the walkthrough", () => {
    expect(phaseFor("onboarding", "ready")).toBe("aboard");
  });

  it("says nothing in front of the walkthrough", () => {
    expect(phaseFor("checking", "onboarding")).toBeNull();
  });

  it("keeps waiting while the first check is still out", () => {
    expect(phaseFor("checking", "checking")).toBe("checking");
  });

  /**
   * The gate really does fall back to `checking` mid-session — a refetch, a
   * remount, the walkthrough's own "check again". Covering a live screen for it
   * put a full-window curtain over the walkthrough twice in a row, which is
   * how this rule was found.
   */
  it("does not throw the curtain back over a screen already in use", () => {
    expect(phaseFor("ready", "checking")).toBeNull();
    expect(phaseFor("onboarding", "checking")).toBeNull();
  });
});
