import { describe, expect, it } from "vitest";

import { track } from "@/features/library/testFixtures";
import { nextSort, sortTracks, type TrackSort } from "@/features/library/tracks/sort";

const library = [
  track({ id: 1, title: "Aerodynamic", artist: "Daft Punk", album: "Discovery", genre: "House", length: 212 }),
  track({ id: 2, title: "Zero", artist: "Chvrches", album: "Every Open Eye", genre: "Synthpop", length: 195 }),
  track({ id: 3, title: "Motion", artist: "Boards of Canada", album: "Geogaddi", genre: null, length: null }),
];

const ids = (tracks: typeof library) => tracks.map((item) => item.id);

describe("nextSort", () => {
  it("starts a fresh column ascending", () => {
    expect(nextSort(null, "title")).toEqual({ key: "title", dir: "asc" });
    expect(nextSort({ key: "artist", dir: "desc" }, "title")).toEqual({ key: "title", dir: "asc" });
  });

  it("flips the active column, then drops the sort", () => {
    // The third click has to return the library's own order: the header is the
    // only control that could get the user back to it.
    const first = nextSort(null, "title") as TrackSort;
    const second = nextSort(first, "title") as TrackSort;
    expect(second).toEqual({ key: "title", dir: "desc" });
    expect(nextSort(second, "title")).toBeNull();
  });
});

describe("sortTracks", () => {
  it("returns the input array itself when unsorted", () => {
    expect(sortTracks(library, null)).toBe(library);
  });

  it("orders text ascending and descending", () => {
    expect(ids(sortTracks(library, { key: "title", dir: "asc" }))).toEqual([1, 3, 2]);
    expect(ids(sortTracks(library, { key: "title", dir: "desc" }))).toEqual([2, 3, 1]);
    expect(ids(sortTracks(library, { key: "artist", dir: "asc" }))).toEqual([3, 2, 1]);
  });

  it("orders durations shortest first", () => {
    expect(ids(sortTracks(library, { key: "length", dir: "asc" }))).toEqual([2, 1, 3]);
  });

  it("sinks missing values in both directions", () => {
    // Track 3 has no genre and no length: absence is not a value to rank, so it
    // stays at the bottom even when the order is reversed.
    expect(ids(sortTracks(library, { key: "genre", dir: "asc" }))).toEqual([1, 2, 3]);
    expect(ids(sortTracks(library, { key: "genre", dir: "desc" }))).toEqual([2, 1, 3]);
    expect(ids(sortTracks(library, { key: "length", dir: "desc" }))).toEqual([1, 2, 3]);
  });

  it("leaves ties in the library's own order", () => {
    const tied = [
      track({ id: 1, genre: "House", title: "Zero" }),
      track({ id: 2, genre: "House", title: "Alpha" }),
      track({ id: 3, genre: "House", title: "Motion" }),
    ];
    expect(ids(sortTracks(tied, { key: "genre", dir: "asc" }))).toEqual([1, 2, 3]);
  });

  it("does not mutate the list it was given", () => {
    const input = [...library];
    sortTracks(input, { key: "title", dir: "desc" });
    expect(ids(input)).toEqual([1, 2, 3]);
  });
});
