import { describe, expect, it } from "vitest";

import { triagePaths } from "@/app/paths";
import { track } from "@/features/library/testFixtures";
import { applyTrackTriage, parseTrackTriage, type TrackTriage } from "@/features/library/tracks/triage";

function paramsOf(path: string): URLSearchParams {
  return new URLSearchParams(path.split("?")[1]);
}

function triage(over: Partial<TrackTriage> = {}): TrackTriage {
  return {
    missingYear: false,
    missingTrackNumber: false,
    genre: null,
    family: null,
    category: null,
    decade: null,
    suspectMatch: false,
    duplicateRecording: false,
    ...over,
  };
}

const library = [
  track({ id: 1, year: 2001, genre: "Grunge", genreBucket: "rock", category: "Music" }),
  track({ id: 2, year: null, genre: "Gamelan", genreBucket: null, category: "Video Games" }),
  track({ id: 3, year: 1994, genre: null, genreBucket: null }),
  track({ id: 4, year: null, genre: "", genreBucket: null }),
];

describe("parseTrackTriage", () => {
  it("round-trips the published deep links", () => {
    expect(parseTrackTriage(paramsOf(triagePaths.missingYear))).toEqual(triage({ missingYear: true }));
    expect(parseTrackTriage(paramsOf(triagePaths.missingTrackNumber))).toEqual(triage({ missingTrackNumber: true }));
    expect(parseTrackTriage(paramsOf(triagePaths.genreMissing))).toEqual(triage({ genre: "missing" }));
    expect(parseTrackTriage(paramsOf(triagePaths.genreOffTree))).toEqual(triage({ genre: "off-tree" }));
    expect(parseTrackTriage(paramsOf(triagePaths.suspectMatch))).toEqual(triage({ suspectMatch: true }));
    expect(parseTrackTriage(paramsOf(triagePaths.duplicateRecording))).toEqual(triage({ duplicateRecording: true }));
  });

  it("is inert on unrelated or unknown params", () => {
    expect(parseTrackTriage(new URLSearchParams(""))).toEqual(triage());
    expect(parseTrackTriage(new URLSearchParams("missing=artwork&foo=bar"))).toEqual(triage());
  });

  it("reads the filter bar's own axes", () => {
    expect(parseTrackTriage(new URLSearchParams("category=Film"))).toEqual(triage({ category: "Film" }));
    expect(parseTrackTriage(new URLSearchParams("decade=1990"))).toEqual(triage({ decade: 1990 }));
  });

  it("normalises a decade and drops an unparsable one", () => {
    // A hand-edited or stale URL must land somewhere sensible rather than
    // filtering the list down to nothing.
    expect(parseTrackTriage(new URLSearchParams("decade=1994")).decade).toBe(1990);
    expect(parseTrackTriage(new URLSearchParams("decade=nineties")).decade).toBeNull();
    expect(parseTrackTriage(new URLSearchParams("decade=")).decade).toBeNull();
  });
});

describe("applyTrackTriage", () => {
  it("returns the list untouched when nothing is active", () => {
    expect(applyTrackTriage(library, triage())).toBe(library);
  });

  it("keeps only tracks with no year", () => {
    expect(applyTrackTriage(library, triage({ missingYear: true })).map((t) => t.id)).toEqual([2, 4]);
  });

  /** beets writes an absent position as 0, so the predicate has to refuse both
   * shapes or every untagged file passes for numbered. */
  it("keeps tracks with no position, null and zero alike", () => {
    const rows = [
      track({ id: 1, track: 1 }),
      track({ id: 2, track: null }),
      track({ id: 3, track: 0 }),
      track({ id: 4, track: null, accepted: ["track"] }),
    ];
    expect(applyTrackTriage(rows, triage({ missingTrackNumber: true })).map((t) => t.id)).toEqual([2, 3]);
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

  it("keeps a whole family under ?family=, sentinels included", () => {
    // The genre page's "view tracks" door: the family key resolves through
    // familyKeyOf, so the two sides count the same tracks.
    expect(applyTrackTriage(library, triage({ family: "rock" })).map((t) => t.id)).toEqual([1]);
    expect(applyTrackTriage(library, triage({ family: "__other__" })).map((t) => t.id)).toEqual([2]);
    expect(applyTrackTriage(library, triage({ family: "__none__" })).map((t) => t.id)).toEqual([3, 4]);
  });

  it("keeps only tracks carrying a category", () => {
    expect(applyTrackTriage(library, triage({ category: "Video Games" })).map((t) => t.id)).toEqual([2]);
    expect(applyTrackTriage(library, triage({ category: "Film" }))).toEqual([]);
  });

  it("keeps only tracks of a decade, undated ones excluded", () => {
    expect(applyTrackTriage(library, triage({ decade: 2000 })).map((t) => t.id)).toEqual([1]);
    expect(applyTrackTriage(library, triage({ decade: 1990 })).map((t) => t.id)).toEqual([3]);
  });

  it("composes active filters", () => {
    const both = triage({ missingYear: true, genre: "missing" });
    expect(applyTrackTriage(library, both).map((t) => t.id)).toEqual([4]);
  });

  it("composes a browsing axis with a correction filter", () => {
    // The two kinds of filter share one pass: a category plus a decade narrows
    // to their intersection, not to whichever ran last.
    expect(applyTrackTriage(library, triage({ category: "Music", decade: 2000 })).map((t) => t.id)).toEqual([1]);
    expect(applyTrackTriage(library, triage({ category: "Music", decade: 1990 }))).toEqual([]);
  });

  it("keeps only flagged matches under ?suspect=match", () => {
    const flagged = [track({ id: 1, suspectMatch: true }), track({ id: 2 })];
    expect(applyTrackTriage(flagged, triage({ suspectMatch: true })).map((t) => t.id)).toEqual([1]);
  });

  it("keeps only tracks sharing a recording under ?duplicates=recording", () => {
    // Regression (Spirit): the same video imported as a single and again
    // inside a playlist — both copies carry the same MusicBrainz recording.
    const doubled = [
      track({ id: 1, mbTrackId: "rec-a" }),
      track({ id: 2, mbTrackId: "rec-b" }),
      track({ id: 3, mbTrackId: "rec-a" }),
      track({ id: 4, mbTrackId: null }),
      track({ id: 5, mbTrackId: null }),
    ];
    expect(applyTrackTriage(doubled, triage({ duplicateRecording: true })).map((t) => t.id)).toEqual([1, 3]);
  });
});
