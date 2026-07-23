import { describe, expect, it } from "vitest";

import { triagePaths } from "@/app/paths";
import { track } from "@/features/library/testFixtures";
import { applyTrackTriage, parseTrackTriage, type TrackTriage } from "@/features/library/tracks/triage";

function paramsOf(path: string): URLSearchParams {
  return new URLSearchParams(path.split("?")[1]);
}

function triage(over: Partial<TrackTriage> = {}): TrackTriage {
  return { missingYear: false, genre: null, ...over };
}

const library = [
  track({ id: 1, year: 2001, genre: "Grunge", genreBucket: "rock" }),
  track({ id: 2, year: null, genre: "Gamelan", genreBucket: null }),
  track({ id: 3, year: 1994, genre: null, genreBucket: null }),
  track({ id: 4, year: null, genre: "", genreBucket: null }),
];

describe("parseTrackTriage", () => {
  it("round-trips the published deep links", () => {
    expect(parseTrackTriage(paramsOf(triagePaths.missingYear))).toEqual(triage({ missingYear: true }));
    expect(parseTrackTriage(paramsOf(triagePaths.genreMissing))).toEqual(triage({ genre: "missing" }));
    expect(parseTrackTriage(paramsOf(triagePaths.genreOffTree))).toEqual(triage({ genre: "off-tree" }));
  });

  it("is inert on unrelated or unknown params", () => {
    expect(parseTrackTriage(new URLSearchParams(""))).toEqual(triage());
    expect(parseTrackTriage(new URLSearchParams("missing=artwork&foo=bar"))).toEqual(triage());
  });
});

describe("applyTrackTriage", () => {
  it("returns the list untouched when nothing is active", () => {
    expect(applyTrackTriage(library, triage())).toBe(library);
  });

  it("keeps only tracks with no year", () => {
    expect(applyTrackTriage(library, triage({ missingYear: true })).map((t) => t.id)).toEqual([2, 4]);
  });

  it("treats an empty genre like a missing one, matching the genres page", () => {
    expect(applyTrackTriage(library, triage({ genre: "missing" })).map((t) => t.id)).toEqual([3, 4]);
  });

  it("keeps only genres the tree did not bucket", () => {
    expect(applyTrackTriage(library, triage({ genre: "off-tree" })).map((t) => t.id)).toEqual([2]);
  });

  it("matches a plain genre name exactly", () => {
    expect(applyTrackTriage(library, triage({ genre: "Grunge" })).map((t) => t.id)).toEqual([1]);
    expect(applyTrackTriage(library, triage({ genre: "grunge" }))).toEqual([]);
  });

  it("composes active filters", () => {
    const both = triage({ missingYear: true, genre: "missing" });
    expect(applyTrackTriage(library, both).map((t) => t.id)).toEqual([4]);
  });
});
