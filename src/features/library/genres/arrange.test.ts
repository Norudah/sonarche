import { describe, expect, it } from "vitest";

import { canDragGenre, canDropOn, ghostFamilies } from "@/features/library/genres/arrange";
import { FAMILY_KEYS, FAMILY_NONE, FAMILY_OTHER, type Family } from "@/features/library/genres/genres";

function family(key: string): Family {
  return { key, trackCount: 1, albums: [], artistCount: 0, share: 0, subs: [] };
}

describe("ghostFamilies", () => {
  it("conjures exactly the families with no card", () => {
    const ghosts = ghostFamilies([family("Rock"), family("Pop"), family(FAMILY_OTHER)]);
    expect(ghosts).toHaveLength(FAMILY_KEYS.length - 2);
    expect(ghosts).not.toContain("Rock");
    expect(ghosts).not.toContain("Pop");
    expect(ghosts).toContain("Jazz");
  });

  it("keeps the sentinels out of the ghost list", () => {
    // A library holding every family needs no ghosts — Other and None must
    // never surface as families-to-be.
    const ghosts = ghostFamilies([...FAMILY_KEYS.map(family), family(FAMILY_OTHER), family(FAMILY_NONE)]);
    expect(ghosts).toEqual([]);
  });

  it("an empty library ghosts the whole tree", () => {
    expect(ghostFamilies([])).toEqual([...FAMILY_KEYS]);
  });
});

describe("canDragGenre", () => {
  it("pins the family roots and frees everything else", () => {
    expect(canDragGenre("Rock")).toBe(false);
    expect(canDragGenre("hip hop")).toBe(false);
    expect(canDragGenre("Grunge")).toBe(true);
  });
});

describe("canDropOn", () => {
  it("refuses the chip's own family — that is a no-op, not a move", () => {
    expect(canDropOn("Rock", "Rock")).toBe(false);
    expect(canDropOn("Rock", "Pop")).toBe(true);
  });

  it("refuses both sentinels", () => {
    // Other is left by "original placement", not entered by drop; None is the
    // absence of a genre, not a shelf.
    expect(canDropOn(FAMILY_OTHER, "Rock")).toBe(false);
    expect(canDropOn(FAMILY_NONE, "Rock")).toBe(false);
  });

  it("accepts every real family, coming from a sentinel too", () => {
    for (const key of FAMILY_KEYS) expect(canDropOn(key, FAMILY_OTHER)).toBe(true);
  });

  it("refuses a key outside the closed set", () => {
    expect(canDropOn("Chiptune", "Rock")).toBe(false);
  });
});
