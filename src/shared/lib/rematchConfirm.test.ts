import { describe, expect, it } from "vitest";

import { parseRematchConfirm } from "@/shared/lib/rematchConfirm";

describe("parseRematchConfirm", () => {
  it("defaults to asking when nobody has chosen", () => {
    expect(parseRematchConfirm(null)).toBe(true);
    expect(parseRematchConfirm(undefined)).toBe(true);
  });

  it("only the explicit off silences the dialog", () => {
    expect(parseRematchConfirm("off")).toBe(false);
    expect(parseRematchConfirm("on")).toBe(true);
    expect(parseRematchConfirm("garbage")).toBe(true);
  });
});
