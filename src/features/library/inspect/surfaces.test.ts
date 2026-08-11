import { describe, expect, it } from "vitest";

import { isInspectable } from "@/features/library/inspect/surfaces";

const overview = new URLSearchParams();
const tracks = new URLSearchParams("view=tracks");

describe("isInspectable", () => {
  it("accepts the tracks explorer, which has no other face", () => {
    expect(isInspectable("/library/tracks", overview)).toBe(true);
    expect(isInspectable("/library/tracks", new URLSearchParams("missing=year"))).toBe(true);
  });

  it("accepts a scoped page only while it is showing its tracks", () => {
    expect(isInspectable("/library/artists/Magdalena%20Bay", tracks)).toBe(true);
    expect(isInspectable("/library/genres/electronic", tracks)).toBe(true);
    expect(isInspectable("/library/categories/Video%20Games", tracks)).toBe(true);

    // Same pages on their index: covers and cards, nothing for the lens to redraw.
    expect(isInspectable("/library/artists/Magdalena%20Bay", overview)).toBe(false);
    expect(isInspectable("/library/genres/electronic", overview)).toBe(false);
  });

  it("rejects the shelves, whatever the view param says", () => {
    expect(isInspectable("/library/albums", tracks)).toBe(false);
    expect(isInspectable("/library/artists", tracks)).toBe(false);
    expect(isInspectable("/library/genres", tracks)).toBe(false);
  });

  it("rejects everything outside the library", () => {
    expect(isInspectable("/", overview)).toBe(false);
    expect(isInspectable("/metadata", overview)).toBe(false);
    expect(isInspectable("/settings/library", tracks)).toBe(false);
  });

  it("rejects an album, which keeps its own tracklist", () => {
    expect(isInspectable("/library/albums/Air/Moon%20Safari", tracks)).toBe(false);
  });
});
