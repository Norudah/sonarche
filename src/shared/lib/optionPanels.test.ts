import { describe, expect, it } from "vitest";

import { parseAutoExpand } from "@/shared/lib/optionPanels";

describe("parseAutoExpand", () => {
  it("opens the panel for anyone who has not chosen", () => {
    expect(parseAutoExpand(null)).toBe(true);
    expect(parseAutoExpand(undefined)).toBe(true);
    expect(parseAutoExpand("")).toBe(true);
  });

  it("only the exact stored word switches it off", () => {
    expect(parseAutoExpand("off")).toBe(false);
    expect(parseAutoExpand("on")).toBe(true);
    // A value written by an older build, or by hand: unreadable means unchosen,
    // and unchosen means on — never a silently folded panel.
    expect(parseAutoExpand("false")).toBe(true);
  });
});
