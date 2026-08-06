import { describe, expect, it } from "vitest";

import { parseNotificationBadges } from "@/features/settings/notificationBadges";

describe("parseNotificationBadges", () => {
  it("is on until somebody turns it off", () => {
    expect(parseNotificationBadges(null)).toBe(true);
    expect(parseNotificationBadges(undefined)).toBe(true);
    expect(parseNotificationBadges("on")).toBe(true);
  });

  it("is off only on the exact stored word", () => {
    expect(parseNotificationBadges("off")).toBe(false);
  });

  /**
   * The default has to survive a value we do not recognise — a key written by
   * an older build, or by hand. Falling back to "off" would silently retire
   * the page's main door knocker.
   */
  it("treats anything it does not recognise as on", () => {
    expect(parseNotificationBadges("")).toBe(true);
    expect(parseNotificationBadges("false")).toBe(true);
    expect(parseNotificationBadges("OFF")).toBe(true);
  });
});
