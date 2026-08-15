import { describe, expect, it } from "vitest";

import { parseShelfLayout } from "@/features/library/shelfLayout";

describe("parseShelfLayout", () => {
  it("reads back the stored choice", () => {
    expect(parseShelfLayout("list")).toBe("list");
    expect(parseShelfLayout("grid")).toBe("grid");
  });

  it("falls back to the grid on anything unreadable", () => {
    // A first visit, a cleared storage, a value written by an older build.
    expect(parseShelfLayout(null)).toBe("grid");
    expect(parseShelfLayout("")).toBe("grid");
    expect(parseShelfLayout("rows")).toBe("grid");
  });
});
