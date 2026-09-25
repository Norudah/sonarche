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

  /** The gate can fall back to `checking` mid-session; the curtain must not return. */
  it("does not throw the curtain back over a screen already in use", () => {
    expect(phaseFor("ready", "checking", WELCOME)).toBeNull();
    expect(phaseFor("onboarding", "checking", WELCOME)).toBeNull();
  });

  describe("with the welcome switched off", () => {
    it("drops both beats, not just the one seen at every launch", () => {
      expect(phaseFor("checking", "ready", false)).toBeNull();
      expect(phaseFor("onboarding", "ready", false)).toBeNull();
    });

    /** The setting only affects the greeting, not the wait. */
    it("still holds the window while the first check runs", () => {
      expect(phaseFor("checking", "checking", false)).toBe("checking");
    });
  });
});
