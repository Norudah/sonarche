import { describe, expect, it } from "vitest";

import { keyView } from "@/features/onboarding/keyView";

const base = {
  page: "intro" as const,
  configured: false,
  changing: false,
  saving: false,
  rejected: false,
  justSaved: false,
};

describe("keyView", () => {
  it("follows the page while nothing is stored", () => {
    expect(keyView({ ...base })).toBe("intro");
    expect(keyView({ ...base, page: "steps" })).toBe("steps");
  });

  it("shows the check in flight over everything else", () => {
    expect(keyView({ ...base, page: "steps", saving: true, rejected: true })).toBe("verifying");
  });

  it("reports a refusal", () => {
    expect(keyView({ ...base, page: "steps", rejected: true })).toBe("rejected");
  });

  // The key query refetches as configured right after a save; the screen
  // must still say "saved just now", not "already saved".
  it("tells a key saved just now from one stored before", () => {
    expect(keyView({ ...base, configured: true, justSaved: true })).toBe("verified");
    expect(keyView({ ...base, configured: true })).toBe("saved");
  });

  it("reopens the steps to change a stored key", () => {
    expect(keyView({ ...base, page: "steps", configured: true, changing: true })).toBe("steps");
  });
});
