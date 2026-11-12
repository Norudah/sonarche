import { describe, expect, it } from "vitest";

import { entranceSchedule, skipSchedule } from "@/features/onboarding/entrance";

describe("entranceSchedule", () => {
  it("opens, welcomes, then dissolves, in under four seconds", () => {
    const steps = entranceSchedule(true);
    expect(steps.map((step) => step.phase)).toEqual(["opening", "welcome", "closing", "done"]);
    expect(steps[steps.length - 1].at).toBeLessThan(4000);
  });

  // The Appearance switch and reduced motion both drop the words and the zoom.
  it("only fades when the welcome is off", () => {
    expect(entranceSchedule(false).map((step) => step.phase)).toEqual(["fading", "done"]);
  });
});

describe("skipSchedule", () => {
  it("cuts the opening and the welcome short", () => {
    expect(skipSchedule("opening")?.[0]).toEqual({ phase: "closing", at: 0 });
    expect(skipSchedule("welcome")?.[0]).toEqual({ phase: "closing", at: 0 });
  });

  it("leaves a dissolve already under way alone", () => {
    expect(skipSchedule("closing")).toBeNull();
    expect(skipSchedule("fading")).toBeNull();
    expect(skipSchedule("idle")).toBeNull();
  });
});
