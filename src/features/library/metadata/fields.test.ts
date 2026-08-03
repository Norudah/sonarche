import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  COMPLETENESS_KEYS,
  countFilled,
  diffFields,
  effectiveEdit,
  formatBitrate,
  toFieldValues,
} from "@/features/library/metadata/fields";

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
    track: 2,
    trackTotal: 12,
    length: 178,
    bitrate: 256000,
    format: "AAC",
    path: "/music/monster.m4a",
    audioUrl: "asset://music/monster.m4a",
    artUrl: null,
    artPath: null,
    bonusSource: null,
    mbTrackId: null,
    suspectMatch: false,
    provisionalCover: false,
    category: null,
    soundtrack: false,
    ...over,
  };
}

describe("toFieldValues", () => {
  it("prints the track number alone — the total is album-level, edited elsewhere", () => {
    expect(toFieldValues(track({ track: 2, trackTotal: 12 })).track).toBe("2");
  });

  it("leaves the track empty when there is no number", () => {
    expect(toFieldValues(track({ track: null, trackTotal: 12 })).track).toBe("");
  });

  it("turns missing numbers and genre into empty strings, never 'null'", () => {
    const bare = toFieldValues(track({ year: null, genre: null }));
    expect(bare.year).toBe("");
    expect(bare.genre).toBe("");
  });

  it("keeps year 0 as a value rather than dropping it", () => {
    // `!= null` on purpose: a falsy-but-present number is still a value.
    expect(toFieldValues(track({ year: 0 })).year).toBe("0");
  });
});

describe("countFilled", () => {
  it("counts every completeness field on a fully tagged track", () => {
    expect(countFilled(toFieldValues(track()))).toBe(COMPLETENESS_KEYS.length);
  });

  it("does not count a whitespace-only value as filled", () => {
    const values = toFieldValues(track({ album: "   ", genre: "" }));
    expect(countFilled(values)).toBe(COMPLETENESS_KEYS.length - 2);
  });

  it("counts nothing on an empty track", () => {
    const empty = toFieldValues(
      track({ title: "", artist: "", albumArtist: "", album: "", year: null, track: null, genre: null }),
    );
    expect(countFilled(empty)).toBe(0);
  });

  it("never counts the category — optional by nature, in or out", () => {
    const bare = countFilled(toFieldValues(track({ category: null })));
    const tagged = countFilled(toFieldValues(track({ category: "Video Games" })));
    expect(tagged).toBe(bare);
  });
});

describe("diffFields", () => {
  it("returns nothing when the draft matches the live values", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live })).toEqual({});
  });

  it("emits only the changed fields, under their beets wire keys", () => {
    const live = toFieldValues(track());
    const patch = diffFields(live, { ...live, title: "New Title", albumArtist: "V.A." });
    expect(patch).toEqual({ title: "New Title", albumartist: "V.A." });
  });

  it("carries an emptied field through as an empty string, not a drop", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live, genre: "" })).toEqual({ genre: "" });
  });

  it("ships a category edit under beets' grouping key", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live, category: "Video Games" })).toEqual({ grouping: "Video Games" });
  });

  // Regression: the sidecar trims on write, so a whitespace-only difference
  // survived its own save as a phantom pending change.
  it("ignores a whitespace-only difference — the sidecar would not store it", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live, title: " Monster " })).toEqual({});
  });

  it("trims the value it ships, matching what will be stored", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live, title: " New Title " })).toEqual({ title: "New Title" });
  });

  // Regression: the sidecar skips a non-numeric int, so the "saved" draft kept
  // differing from the store and the exit guard fired after every save.
  it("ignores a non-numeric year or track — the sidecar would skip it", () => {
    const live = toFieldValues(track());
    expect(diffFields(live, { ...live, year: "20a9", track: "x" })).toEqual({});
  });
});

describe("effectiveEdit", () => {
  it("compares int fields as numbers — '07' does not move a stored 7", () => {
    expect(effectiveEdit("track", "07", "7")).toBeNull();
    expect(effectiveEdit("year", "0", "")).toBeNull(); // beets stores 0 for "absent"
  });

  it("clears an int field through an emptied value", () => {
    expect(effectiveEdit("year", "", "2009")).toBe("");
  });

  it("treats a real move as one, trimmed", () => {
    expect(effectiveEdit("genre", " Post-Rock ", "Rock")).toBe("Post-Rock");
    expect(effectiveEdit("year", "2010", "2009")).toBe("2010");
  });
});

describe("formatBitrate", () => {
  it("converts bps to kbps", () => {
    expect(formatBitrate(192000)).toBe("192");
    expect(formatBitrate(256500)).toBe("257"); // rounded, not truncated
  });

  it("has nothing to show for a missing or nonsensical bitrate", () => {
    expect(formatBitrate(null)).toBeNull();
    expect(formatBitrate(0)).toBeNull();
    expect(formatBitrate(-1)).toBeNull();
  });
});
