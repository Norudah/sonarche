import { describe, expect, it } from "vitest";

import { albumPresence } from "@/features/download/queue/library";
import { albumTrack, job } from "@/features/download/testFixtures";

const inLibrary = (ids: number[]) => (itemId: number) => ids.includes(itemId);

describe("albumPresence", () => {
  it("does not apply until something was actually imported", () => {
    const nothingDone = job({
      kind: "album",
      tracks: [albumTrack({ status: "downloading", itemId: null })],
    });
    expect(albumPresence(nothingDone, inLibrary([]))).toBeNull();
  });

  it("reports full when every imported track is still there", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2 }),
      ],
    });
    expect(albumPresence(album, inLibrary([1, 2]))).toBe("full");
  });

  it("reports partial when some tracks were pulled out, none when all were", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2 }),
      ],
    });
    expect(albumPresence(album, inLibrary([1]))).toBe("partial");
    expect(albumPresence(album, inLibrary([]))).toBe("none");
  });

  it("ignores dropped duplicates — they never had an item of their own", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2, duplicateOf: 1 }),
      ],
    });
    // Without the exclusion the absent duplicate would read as "partial".
    expect(albumPresence(album, inLibrary([1]))).toBe("full");
  });

  it("ignores tracks that never finished importing", () => {
    const album = job({
      kind: "album",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "imported", itemId: 2 }),
      ],
    });
    expect(albumPresence(album, inLibrary([1]))).toBe("full");
  });
});
