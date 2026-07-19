import { describe, expect, it } from "vitest";

import { albumPath } from "@/app/routes";
import {
  albumKey,
  filterAlbums,
  findAlbum,
  groupAlbums,
  sortAlbums,
  type Album,
} from "@/features/library/albums/albums";
import { track } from "@/features/library/testFixtures";

/** Every tracked metadata field filled — the completeness baseline. */
function complete(over: Parameters<typeof track>[0] = {}) {
  return track({
    title: "T",
    artist: "A",
    albumArtist: "A",
    album: "Album",
    year: 2000,
    track: 1,
    genre: "Rock",
    ...over,
  });
}

describe("albumKey", () => {
  it("distinguishes two albums that share a title", () => {
    expect(albumKey("Queen", "Greatest Hits")).not.toBe(albumKey("ABBA", "Greatest Hits"));
  });

  it("does not collide when one name contains the other half's text", () => {
    expect(albumKey("a|b", "c")).not.toBe(albumKey("a", "b|c"));
  });
});

/**
 * Regression: the album route used to carry one percent-encoded key. React
 * Router *decodes* path params, so the view received "Various Artists|Hotline
 * Miami OST" while every album's key was still encoded — every card bounced
 * straight back to the grid. The link and the lookup have to agree after the
 * router's decoding round-trip, which is what these assert.
 */
describe("album route round-trip", () => {
  const decodeParams = (path: string) => {
    const [, , , artist, title] = path.split("/");
    return { artist: decodeURIComponent(artist), title: decodeURIComponent(title) };
  };

  it("survives spaces and punctuation in either half", () => {
    const albums = groupAlbums([
      track({ album: "Hotline Miami OST", albumArtist: "Various Artists" }),
    ]);
    const { artist, title } = decodeParams(albumPath("Various Artists", "Hotline Miami OST"));
    expect(findAlbum(albums, artist, title)?.title).toBe("Hotline Miami OST");
  });

  it("survives a percent sign, which a hand-rolled decode would throw on", () => {
    const albums = groupAlbums([track({ album: "50% Off", albumArtist: "Nobody" })]);
    const { artist, title } = decodeParams(albumPath("Nobody", "50% Off"));
    expect(findAlbum(albums, artist, title)?.title).toBe("50% Off");
  });

  it("survives a slash in the title, which must stay inside its own segment", () => {
    const albums = groupAlbums([track({ album: "AC/DC Live", albumArtist: "AC/DC" })]);
    const path = albumPath("AC/DC", "AC/DC Live");
    expect(path.split("/")).toHaveLength(5);
    const { artist, title } = decodeParams(path);
    expect(findAlbum(albums, artist, title)?.title).toBe("AC/DC Live");
  });
});

describe("groupAlbums", () => {
  it("groups on (album artist, title), not on the title alone", () => {
    const albums = groupAlbums([
      track({ id: 1, album: "Greatest Hits", albumArtist: "Queen" }),
      track({ id: 2, album: "Greatest Hits", albumArtist: "ABBA" }),
    ]);
    expect(albums).toHaveLength(2);
  });

  it("falls back to the track artist when beets left the album artist empty", () => {
    const [album] = groupAlbums([track({ album: "Discovery", artist: "Daft Punk" })]);
    expect(album.artist).toBe("Daft Punk");
  });

  it("keeps a compilation's guest artists under one album artist", () => {
    const albums = groupAlbums([
      track({ id: 1, album: "OST", albumArtist: "Various Artists", artist: "Scattle" }),
      track({ id: 2, album: "OST", albumArtist: "Various Artists", artist: "M|O|O|N" }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].tracks).toHaveLength(2);
  });

  it("drops items with no album rather than inventing an empty one", () => {
    expect(groupAlbums([track({ album: "   ", artist: "A" })])).toEqual([]);
  });

  it("orders tracks by number and sinks the unnumbered ones to the end", () => {
    const [album] = groupAlbums([
      track({ id: 1, album: "X", title: "third", track: 3 }),
      track({ id: 2, album: "X", title: "zeta", track: null }),
      track({ id: 3, album: "X", title: "first", track: 1 }),
      track({ id: 4, album: "X", title: "alpha", track: null }),
    ]);
    expect(album.tracks.map((t) => t.title)).toEqual(["first", "third", "alpha", "zeta"]);
  });

  it("sums playtime, treating an unknown length as zero", () => {
    const [album] = groupAlbums([
      track({ id: 1, album: "X", length: 180 }),
      track({ id: 2, album: "X", length: null }),
    ]);
    expect(album.length).toBe(180);
  });

  it("takes the first available artwork and year, skipping the missing ones", () => {
    const [album] = groupAlbums([
      track({ id: 1, album: "X", track: 1, artUrl: null, year: null }),
      track({ id: 2, album: "X", track: 2, artUrl: "cover.png", year: 1997 }),
    ]);
    expect(album.artUrl).toBe("cover.png");
    expect(album.year).toBe(1997);
  });

  it("lists distinct genres, most frequent first", () => {
    const [album] = groupAlbums([
      track({ id: 1, album: "X", genre: "Pop" }),
      track({ id: 2, album: "X", genre: "Rock" }),
      track({ id: 3, album: "X", genre: "Rock" }),
      track({ id: 4, album: "X", genre: null }),
    ]);
    expect(album.genres).toEqual(["Rock", "Pop"]);
  });

  it("dedupes formats", () => {
    const [album] = groupAlbums([
      track({ id: 1, album: "X", format: "AAC" }),
      track({ id: 2, album: "X", format: "AAC" }),
      track({ id: 3, album: "X", format: "FLAC" }),
    ]);
    expect(album.formats).toEqual(["AAC", "FLAC"]);
  });

  it("scores a fully-tagged album as complete", () => {
    const [album] = groupAlbums([complete({ id: 1 }), complete({ id: 2 })]);
    expect(album.completeness).toBe(1);
  });

  it("counts partial completeness per field, not per track", () => {
    // 2 tracks × 7 fields = 14 cells; one missing genre = 13/14.
    const [album] = groupAlbums([complete({ id: 1 }), complete({ id: 2, genre: null })]);
    expect(album.completeness).toBeCloseTo(13 / 14);
  });

  it("uses the highest item id as the import-recency proxy", () => {
    const [album] = groupAlbums([
      track({ id: 4, album: "X" }),
      track({ id: 91, album: "X" }),
      track({ id: 12, album: "X" }),
    ]);
    expect(album.latestId).toBe(91);
  });
});

describe("sortAlbums", () => {
  const albums = groupAlbums([
    track({ id: 10, album: "Currents", albumArtist: "Tame Impala", year: 2015 }),
    track({ id: 30, album: "Discovery", albumArtist: "Daft Punk", year: 2001 }),
    track({ id: 20, album: "Random Access Memories", albumArtist: "Daft Punk", year: 2013 }),
    track({ id: 5, album: "Untitled", albumArtist: "Aphex Twin", year: null }),
  ]);

  const titles = (list: Album[]) => list.map((a) => a.title);

  it("orders by descending item id for 'recent'", () => {
    expect(titles(sortAlbums(albums, "recent"))).toEqual([
      "Discovery",
      "Random Access Memories",
      "Currents",
      "Untitled",
    ]);
  });

  it("orders by artist, then chronologically within that artist", () => {
    expect(titles(sortAlbums(albums, "artist"))).toEqual([
      "Untitled",
      "Discovery",
      "Random Access Memories",
      "Currents",
    ]);
  });

  it("orders by title", () => {
    expect(titles(sortAlbums(albums, "title"))).toEqual([
      "Currents",
      "Discovery",
      "Random Access Memories",
      "Untitled",
    ]);
  });

  it("orders by descending year and parks the undated album at the end", () => {
    expect(titles(sortAlbums(albums, "year"))).toEqual([
      "Currents",
      "Random Access Memories",
      "Discovery",
      "Untitled",
    ]);
  });

  it("does not mutate its input", () => {
    const before = titles(albums);
    sortAlbums(albums, "title");
    expect(titles(albums)).toEqual(before);
  });
});

describe("filterAlbums", () => {
  const albums = groupAlbums([
    track({ id: 1, album: "Discovery", albumArtist: "Daft Punk", year: 2001, genre: "French House" }),
    track({ id: 2, album: "Chris", albumArtist: "Christine and the Queens", year: 2018 }),
  ]);

  it("returns everything for an empty query", () => {
    expect(filterAlbums(albums, "  ")).toHaveLength(2);
  });

  it("matches on title, artist, year and genre", () => {
    expect(filterAlbums(albums, "daft").map((a) => a.title)).toEqual(["Discovery"]);
    expect(filterAlbums(albums, "2018").map((a) => a.title)).toEqual(["Chris"]);
    expect(filterAlbums(albums, "house").map((a) => a.title)).toEqual(["Discovery"]);
  });

  it("requires every term to match, in any order", () => {
    expect(filterAlbums(albums, "punk discovery").map((a) => a.title)).toEqual(["Discovery"]);
    expect(filterAlbums(albums, "punk chris")).toEqual([]);
  });

  it("ignores diacritics", () => {
    expect(filterAlbums(groupAlbums([track({ album: "Été", artist: "X" })]), "ete")).toHaveLength(1);
  });
});

describe("findAlbum", () => {
  const albums = groupAlbums([
    track({ id: 1, album: "Greatest Hits", albumArtist: "Queen" }),
    track({ id: 2, album: "Greatest Hits", albumArtist: "ABBA" }),
  ]);

  it("needs both halves to match, not the title alone", () => {
    expect(findAlbum(albums, "ABBA", "Greatest Hits")?.artist).toBe("ABBA");
  });

  it("returns null for an unknown pair", () => {
    expect(findAlbum(albums, "Queen", "Nothing")).toBeNull();
    expect(findAlbum(albums, "Nobody", "Greatest Hits")).toBeNull();
  });
});
