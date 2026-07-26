import { NavigationType } from "react-router";
import { describe, expect, it } from "vitest";

import { nextDepth } from "@/shared/navigation/historyDepth";

describe("nextDepth", () => {
  it("stacks an entry on push", () => {
    expect(nextDepth(0, NavigationType.Push)).toBe(1);
    expect(nextDepth(3, NavigationType.Push)).toBe(4);
  });

  it("unstacks an entry on pop", () => {
    expect(nextDepth(2, NavigationType.Pop)).toBe(1);
  });

  it("leaves the count alone on replace", () => {
    // What a filter chip does. Twenty flips must still cost one step back.
    expect(nextDepth(1, NavigationType.Replace)).toBe(1);
  });

  it("never goes below the session root", () => {
    expect(nextDepth(0, NavigationType.Pop)).toBe(0);
  });

  it("returns to zero after a push and its pop", () => {
    expect(nextDepth(nextDepth(0, NavigationType.Push), NavigationType.Pop)).toBe(0);
  });
});
