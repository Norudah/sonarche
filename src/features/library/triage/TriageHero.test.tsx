// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriageHero } from "@/features/library/triage/TriageHero";
import { readNotificationBadges } from "@/shared/lib/notificationBadges";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

// Keys, not sentences: the assertions are about which key the headline picks,
// and the interpolated counts it feeds it.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}(${Object.values(options).join(",")})` : key,
    i18n: { language: "fr" },
  }),
}));

const size = { trackCount: 48, albumCount: 4, artistCount: 4 };

describe("TriageHero headline", () => {
  it("names both kinds when both are waiting", () => {
    render(<TriageHero tally={{ tracks: 14, albums: 2, total: 16 }} {...size} />);

    expect(screen.getByRole("heading").textContent).toBe("toFill.both(library:trackCount(14),library:albumCount(2))");
  });

  /** "0 titre et 2 albums" would read as a scoreboard; a single kind gets a
   * single sentence. */
  it("names one kind alone rather than scoring the other at zero", () => {
    render(<TriageHero tally={{ tracks: 0, albums: 2, total: 2 }} {...size} />);
    expect(screen.getByRole("heading").textContent).toBe("toFill.albums(2)");

    cleanup();
    render(<TriageHero tally={{ tracks: 5, albums: 0, total: 5 }} {...size} />);
    expect(screen.getByRole("heading").textContent).toBe("toFill.tracks(5)");
  });

  it("stays calm on a complete library, and titles itself while loading", () => {
    render(<TriageHero tally={{ tracks: 0, albums: 0, total: 0 }} {...size} />);
    expect(screen.getByRole("heading").textContent).toBe("allClear");

    cleanup();
    render(<TriageHero tally={null} {...size} />);
    expect(screen.getByRole("heading").textContent).toBe("title");
  });
});

describe("TriageHero badge switch", () => {
  it("turns the badge off from the page the badge is about", () => {
    render(<TriageHero tally={{ tracks: 1, albums: 0, total: 1 }} {...size} />);
    expect(readNotificationBadges()).toBe(true);

    fireEvent.click(screen.getByRole("switch"));

    expect(readNotificationBadges()).toBe(false);
  });
});
