import { describe, expect, it } from "vitest";

import { isInspectable } from "@/features/library/inspect/surfaces";

const overview = new URLSearchParams();
const tracks = new URLSearchParams("view=tracks");

describe("isInspectable", () => {
  it("accepts the pages that are a tracklist and nothing else", () => {
    expect(isInspectable("/library/tracks", overview)).toBe(true);
    expect(isInspectable("/library/tracks", new URLSearchParams("missing=year"))).toBe(true);
    expect(isInspectable("/library/albums/Air/Moon%20Safari", overview)).toBe(true);
    expect(isInspectable("/library/playlists/12", overview)).toBe(true);
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

  it("rejects the playlists index, which lists playlists and not tracks", () => {
    expect(isInspectable("/library/playlists", tracks)).toBe(false);
  });
});
