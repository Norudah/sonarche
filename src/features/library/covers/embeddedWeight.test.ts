import { describe, expect, it } from "vitest";

import { formatWeight } from "@/features/library/covers/embeddedWeight";

const weight = (bytes: number, locale = "en") => formatWeight(bytes, locale, "MB", "KB");

describe("formatWeight", () => {
  it("counts in binary units, switching to MB at a mebibyte", () => {
    expect(weight(512 * 1024)).toBe("512 KB");
    expect(weight(1_048_576)).toBe("1 MB");
  });

  it("keeps a decimal below a hundred", () => {
    expect(weight(45_300)).toBe("44.2 KB");
    expect(weight(1_572_864)).toBe("1.5 MB");
  });

  it("never shows less than one kilobyte", () => {
    expect(weight(12)).toBe("1 KB");
  });

  it("follows the interface language's decimal mark", () => {
    expect(weight(1_572_864, "fr")).toBe("1,5 MB");
  });
});
