import { describe, expect, it } from "vitest";

import { parseNotificationBadges } from "@/shared/lib/notificationBadges";

describe("parseNotificationBadges", () => {
  it("is on until somebody turns it off", () => {
    expect(parseNotificationBadges(null)).toBe(true);
    expect(parseNotificationBadges(undefined)).toBe(true);
    expect(parseNotificationBadges("on")).toBe(true);
  });

  it("is off only on the exact stored word", () => {
    expect(parseNotificationBadges("off")).toBe(false);
  });

  /** Unknown values (older builds, hand edits) keep the default. */
  it("treats anything it does not recognise as on", () => {
    expect(parseNotificationBadges("")).toBe(true);
    expect(parseNotificationBadges("false")).toBe(true);
    expect(parseNotificationBadges("OFF")).toBe(true);
  });
});
