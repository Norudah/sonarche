import { describe, expect, it } from "vitest";

import { track } from "@/features/library/testFixtures";
import { decadeOf, facetsOf } from "@/features/library/tracks/facets";

const library = [
  track({ id: 1, year: 1994, genre: "Grunge", genreBucket: "rock", category: "Music" }),
  track({ id: 2, year: 1997, genre: "Britpop", genreBucket: "rock", category: null }),
  track({ id: 3, year: 2003, genre: "House", genreBucket: "electronic", category: "Video Games" }),
  track({ id: 4, year: null, genre: "Gamelan", genreBucket: null, category: "Film" }),
  track({ id: 5, year: 2011, genre: null, genreBucket: null, category: "Film" }),
];

describe("decadeOf", () => {
  it("floors a year onto its decade", () => {
    expect(decadeOf(1994)).toBe(1990);
    expect(decadeOf(1990)).toBe(1990);
    expect(decadeOf(1999)).toBe(1990);
    expect(decadeOf(2000)).toBe(2000);
  });
});

describe("facetsOf", () => {
  it("counts families largest first and leaves the sentinels out", () => {
    // Track 4 (off-tree) and track 5 (no genre) are corrections, not places:
    // the panel owns them, so they must not appear as browsable families.
    expect(facetsOf(library).families).toEqual([
      { value: "rock", trackCount: 2 },
      { value: "electronic", trackCount: 1 },
    ]);
  });

  it("counts categories largest first, ignoring untagged tracks", () => {
    expect(facetsOf(library).categories).toEqual([
      { value: "Film", trackCount: 2 },
      { value: "Music", trackCount: 1 },
      { value: "Video Games", trackCount: 1 },
    ]);
  });

  it("lists decades newest first and skips undated tracks", () => {
    expect(facetsOf(library).decades).toEqual([
      { value: 2010, trackCount: 1 },
      { value: 2000, trackCount: 1 },
      { value: 1990, trackCount: 2 },
    ]);
  });

  it("breaks count ties on the value rather than on iteration order", () => {
    const tied = [
      track({ id: 1, genre: "House", genreBucket: "electronic" }),
      track({ id: 2, genre: "Grunge", genreBucket: "rock" }),
    ];
    expect(facetsOf(tied).families.map((option) => option.value)).toEqual(["electronic", "rock"]);
  });

  it("holds an empty library without dividing by anything", () => {
    expect(facetsOf([])).toEqual({ families: [], categories: [], decades: [] });
  });

  it("hands the same array's facets back without recomputing", () => {
    // The contract the explorer and every scoped page rely on: one pass over
    // the library, however many callers are mounted.
    const first = facetsOf(library);
    expect(facetsOf(library)).toBe(first);
    expect(facetsOf([...library])).not.toBe(first);
  });
});
