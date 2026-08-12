import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import {
  alreadyOn,
  canonicalAlbumId,
  moveInto,
  proposeCollection,
  suggestedArtist,
} from "@/features/library/albums/move";
import { track } from "@/features/library/testFixtures";

function albumOf(tracks: Parameters<typeof groupAlbums>[0]) {
  const albums = groupAlbums(tracks);
  if (albums.length !== 1) throw new Error(`expected one card, got ${albums.length}`);
  return albums[0];
}

describe("canonicalAlbumId", () => {
  it("picks the row holding most of the card", () => {
    const album = albumOf([
      track({ id: 1, album: "Kid A", albumId: 7 }),
      track({ id: 2, album: "Kid A", albumId: 7 }),
      track({ id: 3, album: "Kid A", albumId: 9 }),
    ]);
    expect(canonicalAlbumId(album)).toBe(7);
  });

  it("breaks a tie toward the oldest row", () => {
    const album = albumOf([track({ id: 1, album: "Kid A", albumId: 9 }), track({ id: 2, album: "Kid A", albumId: 7 })]);
    expect(canonicalAlbumId(album)).toBe(7);
  });

  it("is null for a card of singletons", () => {
    const album = albumOf([track({ id: 1, album: "Loose", albumId: null })]);
    expect(canonicalAlbumId(album)).toBeNull();
  });
});

describe("moveInto", () => {
  it("targets the canonical row, arrivals first", () => {
    const target = albumOf([track({ id: 1, album: "Mine", albumId: 7 }), track({ id: 2, album: "Mine", albumId: 7 })]);
    const moving = [track({ id: 10, album: "Kid A", albumId: 3 }), track({ id: 11, album: "Kid A", albumId: 3 })];
    expect(moveInto(moving, target)).toEqual({ targetAlbumId: 7, itemIds: [10, 11] });
  });

  it("absorbs the card's strays in the same pass", () => {
    // The card stands for two beets rows: moving onto it also heals the split.
    const target = albumOf([
      track({ id: 1, album: "Mine", albumId: 7 }),
      track({ id: 2, album: "Mine", albumId: 7 }),
      track({ id: 3, album: "Mine", albumId: 9 }),
    ]);
    const moving = [track({ id: 10, album: "Kid A", albumId: 3 })];
    expect(moveInto(moving, target)).toEqual({ targetAlbumId: 7, itemIds: [10, 3] });
  });

  it("does not list an arrival twice when it already sits on a stray row", () => {
    const target = albumOf([
      track({ id: 1, album: "Mine", albumId: 7 }),
      track({ id: 2, album: "Mine", albumId: 7 }),
      track({ id: 3, album: "Mine", albumId: 9 }),
    ]);
    const moving = [target.tracks.find((candidate) => candidate.id === 3)!];
    expect(moveInto(moving, target)).toEqual({ targetAlbumId: 7, itemIds: [3] });
  });

  it("is null when the card has no row to receive anything", () => {
    const target = albumOf([track({ id: 1, album: "Loose", albumId: null })]);
    expect(moveInto([track({ id: 10 })], target)).toBeNull();
  });
});

describe("proposeCollection", () => {
  it("pre-ticks when tracks arrive from another record", () => {
    const target = albumOf([track({ id: 1, album: "Mine", albumId: 7 })]);
    expect(proposeCollection([track({ id: 10, album: "Kid A" })], target)).toBe(true);
  });

  it("stays unticked for a repair — same album tag coming back together", () => {
    const target = albumOf([track({ id: 1, album: "Kid A", albumId: 7 })]);
    expect(proposeCollection([track({ id: 10, album: "kid a ", albumId: 9 })], target)).toBe(false);
  });

  it("an already-declared collection needs no proposing", () => {
    const target = albumOf([track({ id: 1, album: "Mine", albumId: 7, albumKind: "collection" })]);
    expect(proposeCollection([track({ id: 10, album: "Mine" })], target)).toBe(true);
  });
});

describe("alreadyOn", () => {
  it("is true when every moving track sits on the card", () => {
    const target = albumOf([track({ id: 1, album: "Mine", albumId: 7 }), track({ id: 2, album: "Mine", albumId: 7 })]);
    expect(alreadyOn([target.tracks[0]], target)).toBe(true);
    expect(alreadyOn([target.tracks[0], track({ id: 10 })], target)).toBe(false);
  });
});

describe("suggestedArtist", () => {
  it("suggests the one artist everyone agrees on", () => {
    expect(suggestedArtist([track({ artist: "Muse" }), track({ id: 2, artist: "Muse" })])).toBe("Muse");
  });

  it("suggests nothing for a mixed pile", () => {
    expect(suggestedArtist([track({ artist: "Muse" }), track({ id: 2, artist: "Blur" })])).toBe("");
  });
});
