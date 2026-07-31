import { describe, expect, it } from "vitest";

import { phaseFor } from "@/features/onboarding/splashPhase";

/** The Appearance switch, on — its own case is at the bottom. */
const WELCOME = true;

describe("phaseFor", () => {
  it("welcomes someone whose environment was already in place", () => {
    expect(phaseFor("checking", "ready", WELCOME)).toBe("welcome");
  });

  /** The one that has to be different: this person just spent a minute
   * installing an engine, and "welcome" would ignore what they did. */
  it("sends off someone who has just finished the walkthrough", () => {
    expect(phaseFor("onboarding", "ready", WELCOME)).toBe("aboard");
  });

  it("says nothing in front of the walkthrough", () => {
    expect(phaseFor("checking", "onboarding", WELCOME)).toBeNull();
  });

  it("keeps waiting while the first check is still out", () => {
    expect(phaseFor("checking", "checking", WELCOME)).toBe("checking");
  });

  /**
   * The gate really does fall back to `checking` mid-session — a refetch, a
   * remount, the walkthrough's own "check again". Covering a live screen for it
   * put a full-window curtain over the walkthrough twice in a row, which is
   * how this rule was found.
   */
  it("does not throw the curtain back over a screen already in use", () => {
    expect(phaseFor("ready", "checking", WELCOME)).toBeNull();
    expect(phaseFor("onboarding", "checking", WELCOME)).toBeNull();
  });

  describe("with the welcome switched off", () => {
    it("drops both beats, not just the one seen at every launch", () => {
      expect(phaseFor("checking", "ready", false)).toBeNull();
      expect(phaseFor("onboarding", "ready", false)).toBeNull();
    });

    /** The setting governs the greeting, never the wait itself — an app that
     * opened on nothing while it checked its environment would be a bug, not a
     * preference. */
    it("still holds the window while the first check runs", () => {
      expect(phaseFor("checking", "checking", false)).toBe("checking");
    });
  });
});
