import { describe, expect, it } from "vitest";

import { track } from "@/features/library/testFixtures";
import { extensionOf, unplayableTest } from "@/features/library/playable";

describe("extensionOf", () => {
  it("reads the extension, lowercased and undotted", () => {
    expect(extensionOf("/music/Artist/Album/01 Track.M4A")).toBe("m4a");
    expect(extensionOf("/music/x.opus")).toBe("opus");
  });

  it("has nothing to say about a name that carries none", () => {
    expect(extensionOf("/music/Artist/Track")).toBe("");
    // A dotfile is a name, not an extension.
    expect(extensionOf("/music/.hidden")).toBe("");
  });
});

describe("unplayableTest", () => {
  const test = unplayableTest(["mp3", "m4a", "flac"]);

  it("flags what the engine has no decoder for", () => {
    expect(test(track({ path: "/music/x.wma" }))).toBe(true);
    expect(test(track({ path: "/music/x.opus" }))).toBe(true);
  });

  it("leaves alone what it can play, whatever the case of the name", () => {
    expect(test(track({ path: "/music/x.mp3" }))).toBe(false);
    expect(test(track({ path: "/music/x.FLAC" }))).toBe(false);
  });

  /** A badge that flashes onto every row for one frame and then vanishes is
   * worse than a badge that arrives late. */
  it("says nothing at all until the list has loaded", () => {
    expect(unplayableTest(undefined)(track({ path: "/music/x.wma" }))).toBe(false);
    expect(unplayableTest([])(track({ path: "/music/x.wma" }))).toBe(false);
  });

  it("does not judge a file with no extension", () => {
    expect(test(track({ path: "/music/mystery" }))).toBe(false);
  });
});
