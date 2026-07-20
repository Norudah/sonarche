import { describe, expect, it } from "vitest";

import type { LibraryTrack } from "@/features/library/api";
import {
  COMPLETENESS_KEYS,
  countFilled,
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
    bonusSource: null,
    ...over,
  };
}

describe("toFieldValues", () => {
  it("prints the track number with its total when both are known", () => {
    expect(toFieldValues(track({ track: 2, trackTotal: 12 })).track).toBe("2 / 12");
  });

  it("prints the track number alone when the total is unknown", () => {
    expect(toFieldValues(track({ track: 2, trackTotal: null })).track).toBe("2");
  });

  it("leaves the track empty when there is no number, even with a total", () => {
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
