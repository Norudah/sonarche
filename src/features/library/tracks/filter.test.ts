import { describe, expect, it } from "vitest";

import { track } from "@/features/library/testFixtures";
import { filterTracks, totalPlaytime } from "@/features/library/tracks/filter";

const library = [
  track({ id: 1, title: "Digital Love", artist: "Daft Punk", album: "Discovery", genre: "French House" }),
  track({ id: 2, title: "Nights", artist: "Frank Ocean", album: "Blonde" }),
  track({ id: 3, title: "Été", artist: "Christine and the Queens", album: "Chris" }),
];

describe("filterTracks", () => {
  it("returns everything for an empty or whitespace-only query", () => {
    expect(filterTracks(library, "")).toHaveLength(3);
    expect(filterTracks(library, "   ")).toHaveLength(3);
  });

  it("matches case-insensitively across title, artist and album", () => {
    expect(filterTracks(library, "DAFT").map((t) => t.id)).toEqual([1]);
    expect(filterTracks(library, "blonde").map((t) => t.id)).toEqual([2]);
  });

  it("requires every term to match, in any field and any order", () => {
    expect(filterTracks(library, "daft discovery").map((t) => t.id)).toEqual([1]);
    expect(filterTracks(library, "discovery daft").map((t) => t.id)).toEqual([1]);
    // "love" is in track 1, "blonde" in track 2 — no single track has both.
    expect(filterTracks(library, "love blonde")).toEqual([]);
  });

  it("ignores diacritics both in the query and in the data", () => {
    expect(filterTracks(library, "ete").map((t) => t.id)).toEqual([3]);
    expect(filterTracks(library, "Été").map((t) => t.id)).toEqual([3]);
  });

  it("matches on genre, and does not crash on a null one", () => {
    expect(filterTracks(library, "french").map((t) => t.id)).toEqual([1]);
    expect(filterTracks(library, "zzz")).toEqual([]);
  });

  it("does not match across a field boundary", () => {
    // "punk discovery" as one term must not match the joined haystack.
    expect(filterTracks(library, "punkdiscovery")).toEqual([]);
  });
});

describe("totalPlaytime", () => {
  it("is zero for an empty library", () => {
    expect(totalPlaytime([])).toEqual({ hours: 0, minutes: 0 });
  });

  it("treats a missing length as zero rather than NaN", () => {
    expect(totalPlaytime([track({ length: null }), track({ length: 120 })])).toEqual({
      hours: 0,
      minutes: 2,
    });
  });

  it("splits into hours and minutes", () => {
    expect(totalPlaytime([track({ length: 3600 }), track({ length: 300 })])).toEqual({
      hours: 1,
      minutes: 5,
    });
  });

  it("rolls 60 rounded minutes up into the hour instead of showing 'h 60'", () => {
    expect(totalPlaytime([track({ length: 3599 })])).toEqual({ hours: 1, minutes: 0 });
  });
});
