import { describe, expect, it } from "vitest";

import { matchLanguage, parseLanguage } from "@/shared/i18n/language";

describe("parseLanguage", () => {
  it("accepts the two languages the app ships", () => {
    expect(parseLanguage("fr")).toBe("fr");
    expect(parseLanguage("en")).toBe("en");
  });

  it("returns null for anything else, so the caller can fall back to the desktop", () => {
    expect(parseLanguage("de")).toBeNull();
    expect(parseLanguage("")).toBeNull();
    expect(parseLanguage(null)).toBeNull();
    expect(parseLanguage(undefined)).toBeNull();
  });
});

describe("matchLanguage", () => {
  it("ignores the region subtag", () => {
    expect(matchLanguage("en-GB")).toBe("en");
    expect(matchLanguage("fr-CA")).toBe("fr");
  });

  it("is case-insensitive, as locale tags are", () => {
    expect(matchLanguage("EN-us")).toBe("en");
  });

  it("falls back to French on a language we do not speak", () => {
    expect(matchLanguage("de-DE")).toBe("fr");
    expect(matchLanguage("")).toBe("fr");
    expect(matchLanguage(null)).toBe("fr");
  });
});
