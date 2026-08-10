import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import { buildSuggestionPools, filterSuggestions, hasExactSuggestion } from "@/features/library/metadata/suggestions";

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

describe("buildSuggestionPools", () => {
  it("pools track and album artists together, counting a track once when they agree", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, artist: "Skillet", albumArtist: "Skillet" }),
      track({ id: 2, artist: "Skillet feat. Lacey", albumArtist: "Skillet" }),
    ]);
    expect(pools.artist).toEqual([
      { value: "Skillet", detail: undefined, count: 2 },
      { value: "Skillet feat. Lacey", detail: undefined, count: 1 },
    ]);
  });

  it("orders by track count, then alphabetically", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, genre: "Metal" }),
      track({ id: 2, genre: "Metal" }),
      track({ id: 3, genre: "Blues" }),
      track({ id: 4, genre: "Ambient", genreBucket: null }),
    ]);
    expect(pools.genre.map((s) => s.value)).toEqual(["Metal", "Ambient", "Blues"]);
  });

  it("gives an album its majority artist as detail", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, album: "Awake", albumArtist: "Skillet" }),
      track({ id: 2, album: "Awake", albumArtist: "Skillet" }),
      track({ id: 3, album: "Awake", albumArtist: "Someone Else" }),
    ]);
    expect(pools.album).toEqual([{ value: "Awake", detail: "Skillet", count: 3 }]);
  });

  it("falls back to the track artist when a track has no album artist", () => {
    const pools = buildSuggestionPools([track({ albumArtist: "", artist: "Skillet" })]);
    expect(pools.album[0].detail).toBe("Skillet");
  });

  it("carries the album's cover from the first track that has one", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, artUrl: null }),
      track({ id: 2, artUrl: "asset://covers/awake.jpg?v=1" }),
      track({ id: 3, artUrl: "asset://covers/other.jpg?v=1" }),
    ]);
    expect(pools.album[0].image).toBe("asset://covers/awake.jpg?v=1");
    expect(pools.artist[0].image).toBeUndefined();
  });

  it("carries the genre family as detail and skips empty values", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, genre: "Death Metal", genreBucket: "Metal" }),
      track({ id: 2, genre: null, album: "", artist: "", albumArtist: "" }),
    ]);
    expect(pools.genre).toEqual([{ value: "Death Metal", detail: "Metal", count: 1 }]);
    expect(pools.album).toEqual([{ value: "Awake", detail: "Skillet", count: 1 }]);
  });

  it("keeps values differing only by case distinct — converging them is the user's call", () => {
    const pools = buildSuggestionPools([
      track({ id: 1, artist: "AC/DC", albumArtist: "" }),
      track({ id: 2, artist: "Ac/Dc", albumArtist: "" }),
    ]);
    expect(pools.artist.map((s) => s.value).sort()).toEqual(["AC/DC", "Ac/Dc"]);
  });
});

describe("filterSuggestions", () => {
  it("matches through the detail, so an album is found by its artist", () => {
    const pools = buildSuggestionPools([track({ album: "Awake", albumArtist: "Skillet" })]);
    expect(filterSuggestions(pools.album, "skil awa")).toHaveLength(1);
    expect(filterSuggestions(pools.album, "nope")).toHaveLength(0);
  });
});

describe("hasExactSuggestion", () => {
  it("is exact — matching a stored entry means byte-for-byte, trimmed", () => {
    const pool = buildSuggestionPools([track({ artist: "AC/DC", albumArtist: "" })]).artist;
    expect(hasExactSuggestion(pool, "AC/DC")).toBe(true);
    expect(hasExactSuggestion(pool, " AC/DC ")).toBe(true);
    expect(hasExactSuggestion(pool, "ac/dc")).toBe(false);
    expect(hasExactSuggestion(pool, "")).toBe(false);
  });
});
