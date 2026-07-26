import { describe, expect, it } from "vitest";

import { groupAlbums } from "@/features/library/albums/albums";
import { track } from "@/features/library/testFixtures";
import { scopeTracks } from "@/features/library/tracks/scope";

const library = [
  track({ id: 1, title: "Lithium", album: "Nevermind", artist: "Nirvana", genre: "Grunge", track: 2 }),
  track({ id: 2, title: "Something in the Way", album: "Nevermind", artist: "Nirvana", genre: "Ballad", track: 1 }),
  track({ id: 3, title: "Hydrogen", album: "Hotline Miami", artist: "M|O|O|N", genre: "Synthwave", track: 1 }),
  // No album at all, so `groupAlbums` never files it: the fallback's subject.
  track({ id: 4, title: "Untitled Demo", album: "", artist: "Nirvana", genre: "Grunge" }),
];

const isGrunge = (item: (typeof library)[number]) => item.genre === "Grunge";

describe("scopeTracks", () => {
  it("keeps only the matching tracks of the shelf's albums", () => {
    // Nevermind is a Grunge record but "Something in the Way" is not a Grunge
    // track: playing the genre must not play it.
    const albums = groupAlbums(library);
    expect(scopeTracks(albums, library, isGrunge).map((item) => item.id)).toEqual([1]);
  });

  it("follows the shelf order, then the album order", () => {
    const albums = groupAlbums(library);
    const all = scopeTracks(albums, library, () => true).map((item) => item.id);
    expect(all).toEqual([2, 1, 3]);
  });

  it("falls back to the library when the subject has no album", () => {
    expect(scopeTracks([], library, isGrunge).map((item) => item.id)).toEqual([1, 4]);
  });
});
