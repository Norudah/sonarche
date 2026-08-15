import { describe, expect, it } from "vitest";

import { changelogEntries, compareVersionsDesc } from "@/features/update/changelog/entries";

describe("compareVersionsDesc", () => {
  it("sorts by number and not by string, so 2.10.0 beats 2.9.0", () => {
    expect(["2.9.0", "2.10.0", "1.0.0"].sort(compareVersionsDesc)).toEqual(["2.10.0", "2.9.0", "1.0.0"]);
  });
});

describe("changelogEntries", () => {
  // A guard on the authored files themselves, not on the loader: a note whose
  // front matter or heading was mistyped parses into something the pane draws
  // wrong, and nothing else in the build would notice.
  it("ships every version once, newest first, each with a headline and a date", () => {
    const entries = changelogEntries("fr");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((entry) => entry.version)).toEqual(
      [...entries.map((entry) => entry.version)].sort(compareVersionsDesc),
    );
    for (const entry of entries) {
      expect(entry.title, entry.version).not.toBeNull();
      expect(entry.date, entry.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.sections.length, entry.version).toBeGreaterThan(0);
    }
  });

  it("answers in the language asked for, region tag and all", () => {
    expect(changelogEntries("fr-FR").every((entry) => entry.language === "fr")).toBe(true);
    expect(changelogEntries("en").every((entry) => entry.language === "en")).toBe(true);
  });
});
