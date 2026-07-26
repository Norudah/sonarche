import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import { albumsInCategory, findCategory, groupCategories } from "@/features/library/categories/categories";
import { track } from "@/features/library/testFixtures";
import { scopeTracks } from "@/features/library/tracks/scope";

// A video-game OST crossing two genres, a film soundtrack, and plain
// uncategorized albums around them.
const tracks = [
  track({
    id: 1,
    title: "Hydrogen",
    artist: "M|O|O|N",
    albumArtist: "VA",
    album: "HM OST",
    genre: "Synthwave",
    category: "Video Games",
  }),
  track({
    id: 2,
    title: "Roller Mobster",
    artist: "Brut",
    albumArtist: "VA",
    album: "HM OST",
    genre: "Synthwave",
    category: "Video Games",
  }),
  track({
    id: 3,
    title: "Old Woods",
    artist: "Gallego",
    albumArtist: "Gallego",
    album: "Last Spell",
    genre: "Orchestral",
    category: "Video Games",
  }),
  track({
    id: 4,
    title: "Me voilà",
    artist: "Adams",
    albumArtist: "Adams",
    album: "Spirit",
    genre: "Soft Rock",
    category: "Film",
  }),
  // Same album, not yet categorized: the album must still count as Film.
  track({
    id: 5,
    title: "Run Free",
    artist: "Adams",
    albumArtist: "Adams",
    album: "Spirit",
    genre: "Soft Rock",
    category: null,
  }),
  track({
    id: 6,
    title: "Lithium",
    artist: "Nirvana",
    albumArtist: "Nirvana",
    album: "Nevermind",
    genre: "Grunge",
    category: null,
  }),
  // Categorized but genre-less: counts for the category, absent from its chips.
  track({
    id: 7,
    title: "Menu Theme",
    artist: "Gallego",
    albumArtist: "Gallego",
    album: "Last Spell",
    genre: null,
    category: "Video Games",
  }),
];

const albums = groupAlbums(tracks);
const categories = groupCategories(tracks, albums);

describe("groupCategories", () => {
  it("builds one card per stored value, largest first", () => {
    expect(categories.map((category) => category.name)).toEqual(["Video Games", "Film"]);
    expect(categories[0].trackCount).toBe(4);
    expect(categories[1].trackCount).toBe(1);
  });

  it("admits an album on a single categorized track", () => {
    const film = findCategory(categories, "Film");
    expect(film?.albums.map((album) => album.title)).toEqual(["Spirit"]);
  });

  it("crosses genres inside a category, most frequent first, skipping the genre-less", () => {
    const games = findCategory(categories, "Video Games");
    expect(games?.genres).toEqual([
      { name: "Synthwave", trackCount: 2 },
      { name: "Orchestral", trackCount: 1 },
    ]);
  });

  it("counts artists and library share on the same scales as families", () => {
    const games = findCategory(categories, "Video Games");
    expect(games?.artistCount).toBe(2);
    expect(games?.share).toBeCloseTo(4 / 7);
  });

  it("yields no card at all for an uncategorized library", () => {
    expect(groupCategories([track({ id: 1 })], [])).toEqual([]);
  });
});

describe("albumsInCategory", () => {
  it("narrows the shelf to albums carrying the genre inside the category", () => {
    const games = findCategory(categories, "Video Games");
    expect(albumsInCategory(games!, "Orchestral").map((album) => album.title)).toEqual(["Last Spell"]);
    expect(albumsInCategory(games!, null)).toHaveLength(2);
  });

  it("requires genre and category on the same track, not merely the same album", () => {
    const games = findCategory(categories, "Video Games");
    // "Grunge" exists in the library but never on a categorized track.
    expect(albumsInCategory(games!, "Grunge")).toEqual([]);
  });
});

// The category page's own scope, as the view composes it: `scopeTracks` over the
// shelf with the category predicate. Kept here rather than in `scope.test.ts`
// because what is being checked is this axis' rule, not the helper's.
describe("a category's own tracks", () => {
  const queueOf = (category: string, genre: string | null) => {
    const found = findCategory(categories, category)!;
    return scopeTracks(
      albumsInCategory(found, genre),
      tracks,
      (item) => item.category === found.name && (genre == null || item.genre === genre),
    ).map((item) => item.id);
  };

  it("queues only the categorized tracks, never their album siblings", () => {
    expect(queueOf("Film", null)).toEqual([4]);
  });

  it("narrows the queue with the selected genre", () => {
    expect(queueOf("Video Games", "Synthwave")).toEqual([1, 2]);
  });
});
