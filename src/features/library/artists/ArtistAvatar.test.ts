import { describe, expect, it } from "vitest";

import { genreArt } from "@/features/library/artists/genreArt";
import { FAMILY_NONE, FAMILY_OTHER } from "@/features/library/genres/genres";

// The exact display labels the sidecar emits as `genre_bucket` (genre_tree.py
// `_FAMILIES`) — what `artist.family` actually holds. Keyed here on purpose:
// a lowercase-vs-display mismatch is what once sent every artist to the
// fallback motif.
const FAMILIES = [
  "Metal",
  "Rock",
  "Pop",
  "Electronic",
  "Hip-Hop",
  "Jazz",
  "Blues",
  "Soul & Funk",
  "Folk",
  "Country",
  "Reggae",
  "Latin",
  "Classical",
];

describe("genreArt", () => {
  it("resolves a distinct motif for every sidecar family label in both sets", () => {
    for (const family of FAMILIES) {
      const figure = genreArt(family, "figures");
      const icon = genreArt(family, "icons");
      expect(figure).toBeTruthy();
      expect(icon).toBeTruthy();
      // Not the fallback: the label must actually match a family motif.
      expect(figure).not.toBe(genreArt("__none__", "figures"));
      expect(icon).not.toBe(genreArt("__none__", "icons"));
    }
  });

  it("falls back for the sentinels and any unknown key", () => {
    const fallback = genreArt("__fallback__", "figures");
    expect(genreArt(FAMILY_OTHER, "figures")).toBe(fallback);
    expect(genreArt(FAMILY_NONE, "figures")).toBe(fallback);
    expect(genreArt("bebopcore", "figures")).toBe(fallback);
  });
});
