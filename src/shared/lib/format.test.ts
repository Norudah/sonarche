import { describe, expect, it } from "vitest";

import { formatDuration } from "@/shared/lib/format";

describe("formatDuration", () => {
  it("always pads the seconds to two digits", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("rounds to the nearest second rather than truncating", () => {
    expect(formatDuration(59.6)).toBe("1:00");
    expect(formatDuration(178.4)).toBe("2:58");
  });

  it("keeps counting in minutes past the hour", () => {
    // No hour segment by design: a track long enough to need one is an outlier.
    expect(formatDuration(3600)).toBe("60:00");
  });
});
