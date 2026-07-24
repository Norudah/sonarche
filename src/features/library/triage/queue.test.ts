import { describe, expect, it } from "vitest";

import { triagePaths } from "@/app/paths";
import { groupAlbums } from "@/features/library/albums/albums";
import { track } from "@/features/library/testFixtures";
import { buildTriageQueue, countToFix, type TriageLine } from "@/features/library/triage/queue";

function lineOf(queue: TriageLine[], key: TriageLine["key"]): TriageLine {
  const line = queue.find((entry) => entry.key === key);
  if (!line) throw new Error(`no ${key} line`);
  return line;
}

const tracks = [
  // Complete: on no line.
  track({
    id: 1,
    title: "Clean",
    album: "Done",
    year: 2001,
    genre: "Grunge",
    genreBucket: "rock",
    track: 1,
    trackTotal: 1,
    artUrl: "asset://a.jpg",
  }),
  // Missing year and genre at once: counted on both lines.
  track({
    id: 2,
    title: "Twice Broken",
    album: "Done",
    year: null,
    genre: null,
    track: 1,
    trackTotal: 1,
    artUrl: "asset://a.jpg",
  }),
  // Off-tree genre.
  track({
    id: 3,
    title: "Off Tree",
    album: "Done",
    year: 2001,
    genre: "Gamelan",
    genreBucket: null,
    track: 1,
    trackTotal: 1,
    artUrl: "asset://a.jpg",
  }),
  // An album with no artwork and a gapped tracklist (1 then 3): both album lines.
  track({ id: 4, title: "Gap A", album: "Holes", year: 2001, genre: "Grunge", genreBucket: "rock", track: 1 }),
  track({ id: 5, title: "Gap B", album: "Holes", year: 2001, genre: "Grunge", genreBucket: "rock", track: 3 }),
  // A flagged match and a recording filed twice (Spirit regression).
  track({
    id: 6,
    title: "Sound the Bugle",
    album: "Done",
    year: 2001,
    genre: "Grunge",
    genreBucket: "rock",
    track: 1,
    trackTotal: 1,
    artUrl: "asset://a.jpg",
    suspectMatch: true,
    mbTrackId: "rec-dup",
  }),
  track({
    id: 7,
    title: "You Can't Take Me",
    album: "Done",
    year: 2001,
    genre: "Grunge",
    genreBucket: "rock",
    track: 1,
    trackTotal: 1,
    artUrl: "asset://a.jpg",
    mbTrackId: "rec-dup",
  }),
];

const albums = groupAlbums(tracks.map((item) => ({ ...item, artist: "Artist", albumArtist: "Artist" })));
const queue = buildTriageQueue(tracks, albums);

describe("buildTriageQueue", () => {
  it("counts each line through the same predicates as the explorer", () => {
    expect(lineOf(queue, "year").count).toBe(1);
    expect(lineOf(queue, "genre").count).toBe(2);
    expect(lineOf(queue, "artwork").count).toBe(1);
    expect(lineOf(queue, "tracklist").count).toBe(1);
    expect(lineOf(queue, "suspect").count).toBe(1);
    // Both copies of the shared recording count: the door opens on the pair.
    expect(lineOf(queue, "duplicates").count).toBe(2);
  });

  it("points the review lines at their deep links, with track examples", () => {
    expect(lineOf(queue, "suspect").doors).toEqual([{ key: "suspectMatch", count: 1, to: triagePaths.suspectMatch }]);
    expect(lineOf(queue, "suspect").examples).toEqual(["Sound the Bugle"]);
    expect(lineOf(queue, "duplicates").doors).toEqual([
      { key: "duplicateRecording", count: 2, to: triagePaths.duplicateRecording },
    ]);
    expect(lineOf(queue, "duplicates").examples).toEqual(["Sound the Bugle", "You Can't Take Me"]);
  });

  it("points every door at its contract deep link", () => {
    expect(lineOf(queue, "year").doors).toEqual([{ key: "missingYear", count: 1, to: triagePaths.missingYear }]);
    expect(lineOf(queue, "genre").doors.map((door) => door.to)).toEqual([
      triagePaths.genreMissing,
      triagePaths.genreOffTree,
    ]);
  });

  it("drops a zero door but keeps the fused row alive on the other", () => {
    const missingOnly = buildTriageQueue([track({ id: 1, genre: null, year: 2000 })], []);
    expect(lineOf(missingOnly, "genre").doors.map((door) => door.key)).toEqual(["genreMissing"]);
    expect(lineOf(missingOnly, "genre").count).toBe(1);
  });

  it("names concrete examples, capped and without blank titles", () => {
    expect(lineOf(queue, "genre").examples).toEqual(["Twice Broken", "Off Tree"]);
    const many = buildTriageQueue(
      [
        track({ id: 1, title: "A", year: null }),
        track({ id: 2, title: "", year: null }),
        track({ id: 3, title: "C", year: null }),
        track({ id: 4, title: "D", year: null }),
        track({ id: 5, title: "E", year: null }),
      ],
      [],
    );
    expect(lineOf(many, "year").examples).toEqual(["A", "C", "D"]);
    expect(lineOf(many, "year").count).toBe(5);
  });

  it("uses album titles on the album lines", () => {
    expect(lineOf(queue, "artwork").examples).toEqual(["Holes"]);
    expect(lineOf(queue, "tracklist").examples).toEqual(["Holes"]);
  });
});

describe("countToFix", () => {
  it("adds tracks and albums together — N things, not N tracks", () => {
    expect(countToFix(queue)).toBe(8);
  });

  it("is zero on a clean library", () => {
    const clean = [
      track({
        id: 1,
        title: "Clean",
        album: "Done",
        year: 2001,
        genre: "Grunge",
        genreBucket: "rock",
        track: 1,
        artUrl: "asset://a.jpg",
      }),
    ];
    expect(countToFix(buildTriageQueue(clean, groupAlbums(clean)))).toBe(0);
  });
});
