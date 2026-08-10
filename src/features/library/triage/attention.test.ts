import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import { track } from "@/features/library/testFixtures";
import { albumAttention } from "@/features/library/triage/attention";

/** A record whose second track lacks both a year and a genre, and whose third
 * carries a genre the tree does not know. */
const tracks = [
  track({ id: 1, title: "Clean", album: "Rec", year: 2001, genre: "Grunge", genreBucket: "rock", track: 1 }),
  track({ id: 2, title: "Bare", album: "Rec", year: null, genre: null, track: 2 }),
  track({ id: 3, title: "Odd", album: "Rec", year: 2001, genre: "Gamelan", genreBucket: null, track: 3 }),
];

function attentionOf(rows = tracks, disabled: Parameters<typeof albumAttention>[1] = []) {
  const [album] = groupAlbums(rows);
  return albumAttention(album, disabled);
}

describe("albumAttention", () => {
  it("names a track once, with every door behind it", () => {
    const attention = attentionOf();
    // Track 2 is behind both the year door and a genre one, and is still one
    // entry — the inflated total is exactly what the page was fixed for.
    expect(attention.size).toBe(2);
    expect(attention.get(2)).toEqual(["missingYear", "genreMissing"]);
  });

  it("leaves a settled track out of the map entirely", () => {
    expect(attentionOf().has(1)).toBe(false);
  });

  /** The regression that sent this back to the drawing board: the queue fuses
   * "no genre" and "off-tree genre" into one line, so a record whose every
   * track carried a genre the tree did not know was reported as missing every
   * one of them. Doors, not lines. */
  it("names the door, so an off-tree genre is never reported as a missing one", () => {
    const offTree = tracks.map((row) => (row.id === 2 ? { ...row, genre: "Gamelan", genreBucket: null } : row));
    // Track 2 has no year either, so it keeps that door — it just must not be
    // told its genre is missing when it has one.
    expect(attentionOf(offTree).get(2)).toEqual(["missingYear", "genreOffTree"]);
  });

  it("keeps the two genre doors apart on the same record", () => {
    const attention = attentionOf();
    expect(attention.get(2)).toContain("genreMissing");
    expect(attention.get(3)).toEqual(["genreOffTree"]);
  });

  /** beets stores an absent track number as 0, not as null — a check testing
   * only for null called every untagged file numbered. */
  it("names an untagged position, zero included", () => {
    const unnumbered = tracks.map((row) => (row.id === 1 ? { ...row, track: 0 } : row));
    expect(attentionOf(unnumbered).get(1)).toEqual(["missingTrackNumber"]);
  });

  it("goes silent when the checks are turned off", () => {
    expect(attentionOf(tracks, ["year", "genre"]).size).toBe(0);
  });

  it("goes silent when the checks are answered", () => {
    const answered = tracks.map((row) =>
      row.id === 2 ? { ...row, accepted: ["year" as const, "genre" as const] } : row,
    );
    // Only #3's off-tree genre is left, so the record still has one dot…
    expect(attentionOf(answered).get(3)).toEqual(["genreOffTree"]);
    // …and answering that one takes the last dot off the record for good,
    // which the old completeness ratio could never do.
    const allAnswered = answered.map((row) => (row.id === 3 ? { ...row, accepted: ["genre" as const] } : row));
    expect(attentionOf(allAnswered).size).toBe(0);
  });

  it("ignores album-level doors: a coverless record is not a pending track", () => {
    const coverless = tracks.map((row) => ({ ...row, artUrl: null }));
    expect(attentionOf(coverless).has(1)).toBe(false);
  });
});
