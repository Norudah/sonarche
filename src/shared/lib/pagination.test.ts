import { describe, expect, it } from "vitest";

import { pageWindow } from "@/shared/lib/pagination";

describe("pageWindow", () => {
  it("derives the slice offset from the page", () => {
    expect(pageWindow(1, 7, 3)).toEqual({ page: 1, pageCount: 3, start: 0 });
    expect(pageWindow(3, 7, 3)).toEqual({ page: 3, pageCount: 3, start: 6 });
  });

  it("counts pages from the remainder, never dropping the last partial one", () => {
    expect(pageWindow(1, 7, 3).pageCount).toBe(3);
    expect(pageWindow(1, 7, 7).pageCount).toBe(1);
  });

  it("clamps an out-of-range page instead of pointing past the list", () => {
    // The case that matters: clearing the history while sitting on page 3.
    expect(pageWindow(99, 7, 3).page).toBe(3);
    expect(pageWindow(0, 7, 3).page).toBe(1);
  });

  it("reports one empty page for an empty list rather than zero pages", () => {
    expect(pageWindow(1, 0, 3)).toEqual({ page: 1, pageCount: 1, start: 0 });
  });
});
