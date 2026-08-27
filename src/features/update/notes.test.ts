import { describe, expect, it } from "vitest";

import { parseReleaseNotes } from "@/features/update/notes";

const RELEASE_PLEASE_BODY = `## [1.1.0](https://github.com/Norudah/sonarche/compare/sonarche-v1.0.0...sonarche-v1.1.0) (2026-08-12)

### ⚠ BREAKING CHANGES

* **library:** the genre tree is rebuilt on first launch

### Features

* **library:** let a cover be recropped in place ([1a2b3c4](https://github.com/Norudah/sonarche/commit/1a2b3c4d))
* **onboarding:** pick the language during setup ([5e6f7a8](https://github.com/Norudah/sonarche/commit/5e6f7a8b))

### Bug Fixes

* **ui:** mark every delete as destructive ([9b8c7d6](https://github.com/Norudah/sonarche/commit/9b8c7d6e))

### Miscellaneous

* bump [yt-dlp](https://github.com/yt-dlp/yt-dlp) to 2026.08.01 ([0f1e2d3](https://github.com/Norudah/sonarche/commit/0f1e2d3c))
`;

describe("parseReleaseNotes", () => {
  it("cleans changelog bullets: scope prefix and commit link go, links keep their text", () => {
    const notes = parseReleaseNotes(RELEASE_PLEASE_BODY);
    const features = notes?.sections.find((section) => section.kind === "features");
    expect(features?.items).toEqual(["Let a cover be recropped in place", "Pick the language during setup"]);
    const misc = notes?.sections.find((section) => section.kind === null);
    expect(misc?.title).toBe("Miscellaneous");
    expect(misc?.items).toEqual(["Bump yt-dlp to 2026.08.01"]);
  });

  it("maps the known release-please headings", () => {
    const notes = parseReleaseNotes(RELEASE_PLEASE_BODY);
    expect(notes?.sections.map((section) => section.kind)).toEqual(["breaking", "features", "fixes", null]);
  });

  it("skips the version heading without turning it into a section", () => {
    const notes = parseReleaseNotes(RELEASE_PLEASE_BODY);
    expect(notes?.sections.some((section) => section.title.startsWith("1.1.0"))).toBe(false);
  });

  it("returns null when there is nothing to show", () => {
    expect(parseReleaseNotes(null)).toBeNull();
    expect(parseReleaseNotes("")).toBeNull();
    expect(parseReleaseNotes("See the assets to download this version and install.")).toBeNull();
  });
});
