import { describe, expect, it } from "vitest";

import { albumCompletion } from "@/features/library/albums/albumCompletion";
import type { LibraryTrack } from "@/features/library/api";

function track(over: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 1,
    title: "Monster",
    artist: "Skillet",
    album: "Awake",
    albumArtist: "Skillet",
    year: 2009,
    genre: "Rock",
    genreBucket: "Rock",
    track: 1,
    trackTotal: 12,
    length: 178,
    bitrate: 256000,
    format: "AAC",
    path: "/music/monster.m4a",
    audioUrl: "asset://music/monster.m4a",
    albumId: 1,
    artUrl: null,
    artPath: null,
    bonusSource: null,
    mbTrackId: null,
    suspectMatch: false,
    provisionalCover: false,
    category: null,
    soundtrack: false,
    albumKind: null,
    ...over,
  };
}

describe("albumCompletion", () => {
  it("counts whole tracks, not filled cells", () => {
    const done = albumCompletion([track({ id: 1 }), track({ id: 2, genre: null }), track({ id: 3 })]);

    expect(done.complete).toBe(2);
    expect(done.total).toBe(3);
    expect(done.incompleteIds).toEqual([2]);
  });

  it("names each gap and the tracks it sits on", () => {
    const done = albumCompletion([track({ id: 1, genre: null }), track({ id: 2, genre: null }), track({ id: 3 })]);

    expect(done.gaps).toEqual([{ field: "genre", missing: 2, trackIds: [1, 2] }]);
  });

  it("puts the worst gap first", () => {
    const done = albumCompletion([
      track({ id: 1, genre: null, year: null }),
      track({ id: 2, genre: null }),
      track({ id: 3, genre: null }),
    ]);

    expect(done.gaps.map((gap) => gap.field)).toEqual(["genre", "year"]);
  });

  it("lists the fields that are whole, so a complete column is visible too", () => {
    const done = albumCompletion([track({ id: 1, genre: null })]);

    expect(done.gaps.map((gap) => gap.field)).toEqual(["genre"]);
    expect(done.filled).toEqual(["title", "artist", "albumArtist", "album", "year", "track"]);
  });

  it("leaves the optional fields out — a plain studio album is not incomplete for lacking a category", () => {
    const done = albumCompletion([track({ id: 1, category: null, genreBucket: null })]);

    expect(done.complete).toBe(1);
    expect(done.gaps).toEqual([]);
  });

  it("treats a blank string as a hole, not as a value", () => {
    const done = albumCompletion([track({ id: 1, title: "   " })]);

    expect(done.complete).toBe(0);
    expect(done.gaps).toEqual([{ field: "title", missing: 1, trackIds: [1] }]);
  });

  it("reports an empty record as complete rather than dividing by nothing", () => {
    expect(albumCompletion([])).toMatchObject({ complete: 0, total: 0, gaps: [] });
  });
});
