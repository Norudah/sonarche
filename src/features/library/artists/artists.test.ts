import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import {
  appearancesOf,
  artistInitial,
  filterArtists,
  findArtist,
  groupArtists,
  sortArtists,
} from "@/features/library/artists/artists";
import { track } from "@/features/library/testFixtures";

function artistsOf(tracks: Parameters<typeof groupAlbums>[0]) {
  return groupArtists(groupAlbums(tracks));
}

describe("groupArtists", () => {
  it("groups albums under their album artist", () => {
    const artists = artistsOf([
      track({ id: 1, album: "Discovery", albumArtist: "Daft Punk" }),
      track({ id: 2, album: "Homework", albumArtist: "Daft Punk" }),
      track({ id: 3, album: "Kid A", albumArtist: "Radiohead" }),
    ]);

    expect(artists.map((a) => a.name).sort()).toEqual(["Daft Punk", "Radiohead"]);
    expect(findArtist(artists, "Daft Punk")?.albums).toHaveLength(2);
  });

  it("falls back to the track artist when the album artist is empty", () => {
    const [artist] = artistsOf([track({ id: 1, album: "Bleach", artist: "Nirvana" })]);

    expect(artist.name).toBe("Nirvana");
  });

  it("drops tracks with no artist at all rather than inventing an empty one", () => {
    expect(artistsOf([track({ id: 1, album: "Untitled" })])).toEqual([]);
  });

  it("orders the discography chronologically, undated albums last", () => {
    const [artist] = artistsOf([
      track({ id: 1, album: "Later", albumArtist: "A", year: 2010 }),
      track({ id: 2, album: "Undated", albumArtist: "A", year: null }),
      track({ id: 3, album: "Earlier", albumArtist: "A", year: 1998 }),
    ]);

    expect(artist.albums.map((album) => album.title)).toEqual(["Earlier", "Later", "Undated"]);
  });

  it("sums tracks and playtime across the discography", () => {
    const [artist] = artistsOf([
      track({ id: 1, album: "One", albumArtist: "A", length: 100 }),
      track({ id: 2, album: "One", albumArtist: "A", length: 50 }),
      track({ id: 3, album: "Two", albumArtist: "A", length: 30 }),
    ]);

    expect(artist.trackCount).toBe(3);
    expect(artist.length).toBe(180);
  });

  it("spans from the earliest to the latest dated album, ignoring undated ones", () => {
    const [artist] = artistsOf([
      track({ id: 1, album: "One", albumArtist: "A", year: 2001 }),
      track({ id: 2, album: "Two", albumArtist: "A", year: 1995 }),
      track({ id: 3, album: "Three", albumArtist: "A", year: null }),
    ]);

    expect(artist.span).toEqual({ from: 1995, to: 2001 });
  });

  it("has no span when nothing is dated", () => {
    const [artist] = artistsOf([track({ id: 1, album: "One", albumArtist: "A" })]);

    expect(artist.span).toBeNull();
  });

  it("ranks genres by how many albums carry them", () => {
    const [artist] = artistsOf([
      track({ id: 1, album: "One", albumArtist: "A", genre: "House" }),
      track({ id: 2, album: "Two", albumArtist: "A", genre: "House" }),
      track({ id: 3, album: "Three", albumArtist: "A", genre: "Disco" }),
    ]);

    expect(artist.genres).toEqual(["House", "Disco"]);
  });
});

describe("appearancesOf", () => {
  it("keeps tracks credited to the artist on someone else's album", () => {
    const tracks = [
      track({ id: 1, title: "Own", artist: "Nile Rodgers", albumArtist: "Nile Rodgers" }),
      track({ id: 2, title: "Guest", artist: "Nile Rodgers", albumArtist: "Daft Punk" }),
    ];

    expect(appearancesOf(tracks, "Nile Rodgers").map((t) => t.title)).toEqual(["Guest"]);
  });

  it("treats an empty album artist as the track's own album", () => {
    const tracks = [track({ id: 1, title: "Solo", artist: "A", albumArtist: "" })];

    expect(appearancesOf(tracks, "A")).toEqual([]);
  });

  it("does not claim a remix credited to a different artist", () => {
    const tracks = [track({ id: 1, title: "Remix", artist: "Daft Punk Remix", albumArtist: "Someone" })];

    expect(appearancesOf(tracks, "Daft Punk")).toEqual([]);
  });
});

describe("sortArtists", () => {
  const artists = artistsOf([
    track({ id: 1, album: "One", albumArtist: "Beta" }),
    track({ id: 2, album: "Two", albumArtist: "Beta" }),
    track({ id: 3, album: "Solo", albumArtist: "Alpha" }),
    track({ id: 4, album: "Solo", albumArtist: "Alpha" }),
    track({ id: 5, album: "Solo", albumArtist: "Alpha" }),
  ]);

  it("sorts by name", () => {
    expect(sortArtists(artists, "name").map((a) => a.name)).toEqual(["Alpha", "Beta"]);
  });

  it("sorts by album count, most first", () => {
    expect(sortArtists(artists, "albums").map((a) => a.name)).toEqual(["Beta", "Alpha"]);
  });

  it("sorts by track count, most first", () => {
    expect(sortArtists(artists, "tracks").map((a) => a.name)).toEqual(["Alpha", "Beta"]);
  });

  it("does not mutate its input", () => {
    const before = artists.map((a) => a.name);
    sortArtists(artists, "tracks");
    expect(artists.map((a) => a.name)).toEqual(before);
  });
});

describe("filterArtists", () => {
  const artists = artistsOf([
    track({ id: 1, album: "Discovery", albumArtist: "Daft Punk", genre: "House" }),
    track({ id: 2, album: "Kid A", albumArtist: "Radiohead", genre: "Rock" }),
  ]);

  it("returns everything on an empty query", () => {
    expect(filterArtists(artists, "  ")).toHaveLength(2);
  });

  it("matches on the artist name, ignoring case and accents", () => {
    expect(filterArtists(artists, "DAFT").map((a) => a.name)).toEqual(["Daft Punk"]);
  });

  it("matches through an album title", () => {
    expect(filterArtists(artists, "kid").map((a) => a.name)).toEqual(["Radiohead"]);
  });

  it("matches through a genre", () => {
    expect(filterArtists(artists, "house").map((a) => a.name)).toEqual(["Daft Punk"]);
  });

  it("requires every term to match", () => {
    expect(filterArtists(artists, "daft kid")).toEqual([]);
  });
});

describe("artistInitial", () => {
  it("takes the first grapheme, uppercased", () => {
    expect(artistInitial("daft punk")).toBe("D");
    expect(artistInitial("Ólafur Arnalds")).toBe("Ó");
    expect(artistInitial("  Metallica")).toBe("M");
  });

  it("passes digits and symbols through", () => {
    expect(artistInitial("65daysofstatic")).toBe("6");
    expect(artistInitial("!!!")).toBe("!");
  });

  it("never shears an astral character in half", () => {
    expect(artistInitial("𝕏 Ambassadors")).toBe("𝕏");
  });

  it("gives a blank name a note rather than an empty disc", () => {
    expect(artistInitial("   ")).toBe("♪");
  });
});
