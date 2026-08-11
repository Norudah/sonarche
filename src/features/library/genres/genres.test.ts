import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import type { LibraryTrack } from "@/features/library/api";
import {
  albumsWithGenre,
  countGenres,
  FAMILY_KEYS,
  FAMILY_NONE,
  FAMILY_OTHER,
  filterFamilies,
  findFamily,
  findGenre,
  groupFamilies,
  isFamilyRootGenre,
  listGenres,
} from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { track } from "@/features/library/testFixtures";

function familiesOf(tracks: LibraryTrack[]) {
  return groupFamilies(tracks, groupAlbums(tracks));
}

function genresOf(tracks: LibraryTrack[]) {
  return listGenres(familiesOf(tracks), tracks.length);
}

describe("groupFamilies", () => {
  it("files a track under the bucket the sidecar resolved", () => {
    const families = familiesOf([
      track({ id: 1, album: "Discovery", albumArtist: "Daft Punk", genre: "French House", genreBucket: "Electronic" }),
      track({ id: 2, album: "Kid A", albumArtist: "Radiohead", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(families.map((f) => f.key)).toEqual(["Electronic", "Rock"]);
  });

  it("sends a genre with no family to Other, and no genre at all to None", () => {
    const families = familiesOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Gqom" }),
      track({ id: 2, album: "B", albumArtist: "Y" }),
    ]);

    expect(families.map((f) => f.key)).toEqual([FAMILY_OTHER, FAMILY_NONE]);
    expect(findFamily(families, FAMILY_NONE)?.subs).toEqual([]);
  });

  it("orders families by size, both sentinels last however big", () => {
    const families = familiesOf([
      ...Array.from({ length: 5 }, (_, i) => track({ id: i + 1, album: "Untagged", albumArtist: "X", title: `t${i}` })),
      track({ id: 6, album: "A", albumArtist: "Y", genre: "Gqom", title: "g1" }),
      track({ id: 7, album: "B", albumArtist: "Z", genre: "Gqom", title: "g2" }),
      track({ id: 8, album: "C", albumArtist: "W", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(families.map((f) => f.key)).toEqual(["Rock", FAMILY_OTHER, FAMILY_NONE]);
  });

  it("shares sum to one over the whole library", () => {
    const families = familiesOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "A", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 3, album: "B", albumArtist: "Y", genre: "Teen Pop", genreBucket: "Pop" }),
    ]);

    expect(families.map((f) => f.share)).toEqual([2 / 3, 1 / 3]);
  });

  it("counts sub-genres per family, most frequent first", () => {
    const [rock] = familiesOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 2, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 3, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(rock.subs).toEqual([
      { name: "Art Rock", trackCount: 2 },
      { name: "Grunge", trackCount: 1 },
    ]);
  });
});

describe("album assignment", () => {
  it("files a split album under the family holding most of its tracks", () => {
    const families = familiesOf([
      track({ id: 1, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "OK", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 3, album: "OK", albumArtist: "X", genre: "Teen Pop", genreBucket: "Pop" }),
    ]);

    expect(findFamily(families, "Rock")?.albums.map((a) => a.title)).toEqual(["OK"]);
    expect(findFamily(families, "Pop")?.albums).toEqual([]);
  });

  it("breaks a tie on the bigger family, not on iteration order", () => {
    const tracks = [
      track({ id: 1, album: "Split", albumArtist: "X", genre: "Teen Pop", genreBucket: "Pop" }),
      track({ id: 2, album: "Split", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      // Tips Pop over Rock library-wide without touching the split album.
      track({ id: 3, album: "Other", albumArtist: "Y", genre: "Dance Pop", genreBucket: "Pop" }),
    ];

    expect(findFamily(familiesOf(tracks), "Pop")?.albums.map((a) => a.title)).toEqual(["Split", "Other"]);
    // Same input, reversed: the answer must not move.
    expect(findFamily(familiesOf([...tracks].reverse()), "Pop")?.albums.map((a) => a.title)).toEqual([
      "Other",
      "Split",
    ]);
  });

  it("counts tracks and albums on different units", () => {
    const families = familiesOf([
      track({ id: 1, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 3, album: "OK", albumArtist: "X", genre: "Teen Pop", genreBucket: "Pop" }),
    ]);

    const pop = findFamily(families, "Pop");
    expect(pop?.trackCount).toBe(1);
    expect(pop?.albums).toEqual([]);
  });

  it("counts distinct album artists of the family", () => {
    const [rock] = familiesOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "B", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 3, album: "C", albumArtist: "Y", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(rock.albums).toHaveLength(3);
    expect(rock.artistCount).toBe(2);
  });
});

describe("listGenres", () => {
  it("flattens the families into their genres, largest first", () => {
    const genres = genresOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 3, album: "B", albumArtist: "Y", genre: "Teen Pop", genreBucket: "Pop" }),
    ]);

    expect(genres.map((g) => [g.name, g.family, g.trackCount])).toEqual([
      ["Art Rock", "Rock", 2],
      ["Teen Pop", "Pop", 1],
    ]);
  });

  it("shares are on the whole library, so a genre and a family compare", () => {
    const tracks = [
      track({ id: 1, album: "A", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "A", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 3, album: "B", albumArtist: "Y", genre: "Teen Pop", genreBucket: "Pop" }),
      track({ id: 4, album: "B", albumArtist: "Y", genre: "Teen Pop", genreBucket: "Pop" }),
    ];
    const rock = findFamily(familiesOf(tracks), "Rock");
    const artRock = findGenre(genresOf(tracks), "Rock", "Art Rock");

    expect(rock?.share).toBe(0.5);
    expect(artRock?.share).toBe(0.25);
  });

  it("keeps a genre that straddles two families as two rows", () => {
    const genres = genresOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Crossover", genreBucket: "Rock" }),
      track({ id: 2, album: "B", albumArtist: "Y", genre: "Crossover", genreBucket: "Pop" }),
    ]);

    expect(genres.map((g) => g.family).sort()).toEqual(["Pop", "Rock"]);
    expect(findGenre(genres, "Rock", "Crossover")?.trackCount).toBe(1);
  });

  it("scopes a genre's albums to its own family", () => {
    const genres = genresOf([
      // "OK" is a Rock album by plurality, but carries one Teen Pop track.
      track({ id: 1, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 3, album: "OK", albumArtist: "X", genre: "Teen Pop", genreBucket: "Pop" }),
      track({ id: 4, album: "Four", albumArtist: "Y", genre: "Teen Pop", genreBucket: "Pop" }),
    ]);

    // The Pop genre must not claim a record filed under Rock.
    expect(findGenre(genres, "Pop", "Teen Pop")?.albums.map((a) => a.title)).toEqual(["Four"]);
    expect(findGenre(genres, "Rock", "Art Rock")?.albums.map((a) => a.title)).toEqual(["OK"]);
  });

  it("counts distinct artists of the genre", () => {
    const genres = genresOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 2, album: "B", albumArtist: "Y", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 3, album: "C", albumArtist: "Y", genre: "Grunge", genreBucket: "Rock" }),
    ]);

    expect(findGenre(genres, "Rock", "Grunge")?.artistCount).toBe(2);
  });
});

describe("countGenres", () => {
  it("counts a genre once even when it straddles two families", () => {
    const families = familiesOf([
      track({ id: 1, album: "A", albumArtist: "X", genre: "Crossover", genreBucket: "Rock" }),
      track({ id: 2, album: "B", albumArtist: "Y", genre: "Crossover", genreBucket: "Pop" }),
      track({ id: 3, album: "C", albumArtist: "Z", genre: "Grunge", genreBucket: "Rock" }),
    ]);

    expect(countGenres(families)).toBe(2);
  });
});

describe("filterFamilies", () => {
  it("matches the family name or one of its genres", () => {
    const families = familiesOf([
      track({ id: 1, album: "Discovery", albumArtist: "Daft Punk", genre: "French House", genreBucket: "Electronic" }),
      track({ id: 2, album: "Kid A", albumArtist: "Radiohead", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(filterFamilies(families, "electronic").map((f) => f.key)).toEqual(["Electronic"]);
    expect(filterFamilies(families, "art rock").map((f) => f.key)).toEqual(["Rock"]);
    expect(filterFamilies(families, "")).toHaveLength(2);
  });

  it("ignores albums and artists — this page searches genres, not records", () => {
    const families = familiesOf([
      track({ id: 1, album: "Discovery", albumArtist: "Daft Punk", genre: "French House", genreBucket: "Electronic" }),
      track({ id: 2, album: "Kid A", albumArtist: "Radiohead", genre: "Art Rock", genreBucket: "Rock" }),
    ]);

    expect(filterFamilies(families, "daft")).toEqual([]);
    expect(filterFamilies(families, "kid a")).toEqual([]);
  });
});

describe("albumsWithGenre", () => {
  it("keeps an album as soon as one track carries the genre", () => {
    const [rock] = familiesOf([
      track({ id: 1, album: "OK", albumArtist: "X", genre: "Art Rock", genreBucket: "Rock" }),
      track({ id: 2, album: "OK", albumArtist: "X", genre: "Grunge", genreBucket: "Rock" }),
      track({ id: 3, album: "Bleach", albumArtist: "Y", genre: "Grunge", genreBucket: "Rock" }),
    ]);

    expect(albumsWithGenre(rock, "Art Rock").map((a) => a.title)).toEqual(["OK"]);
    expect(albumsWithGenre(rock, "Grunge").map((a) => a.title)).toEqual(["OK", "Bleach"]);
    expect(albumsWithGenre(rock, null)).toHaveLength(2);
  });
});

describe("isFamilyRootGenre", () => {
  it("blocks the display labels, whatever the case", () => {
    expect(isFamilyRootGenre("Rock")).toBe(true);
    expect(isFamilyRootGenre("  ROCK ")).toBe(true);
    expect(isFamilyRootGenre("Hip-Hop")).toBe(true);
  });

  it("blocks the tree's own root spellings", () => {
    // The stored genre can be the root itself, spelled the tree's way.
    expect(isFamilyRootGenre("hip hop")).toBe(true);
    expect(isFamilyRootGenre("Soul & Funk")).toBe(true);
  });

  it("lets every ordinary genre through", () => {
    expect(isFamilyRootGenre("Dream Pop")).toBe(false);
    expect(isFamilyRootGenre("Grunge")).toBe(false);
  });
});

describe("FAMILY_KEYS", () => {
  it("every family carries an identity tone of its own", () => {
    // A key tone.ts does not know falls back to the Other grey — which would
    // make two menu rows wear the same dot and read as the same family.
    const tones = FAMILY_KEYS.map((key) => toneOf(key));
    expect(new Set(tones).size).toBe(FAMILY_KEYS.length);
    for (const tone of tones) expect(tone).toMatch(/^var\(--family-/);
  });
});
