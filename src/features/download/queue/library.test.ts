import { describe, expect, it } from "vitest";

import { jobDestination, jobPresence } from "@/features/download/queue/library";
import { albumTrack, job, report } from "@/features/download/testFixtures";
import type { LibraryTrack } from "@/features/library/api";
import { track } from "@/features/library/testFixtures";

const inLibrary = (ids: number[]) => (itemId: number) => ids.includes(itemId);

describe("jobPresence", () => {
  it("does not apply while the job is still running", () => {
    const running = job({
      kind: "album",
      status: "importing",
      tracks: [albumTrack({ status: "done", itemId: 1 })],
    });
    expect(jobPresence(running, inLibrary([1]))).toBeNull();
  });

  it("does not apply when nothing was imported", () => {
    const failed = job({ status: "failed", report: null });
    expect(jobPresence(failed, inLibrary([]))).toBeNull();
  });

  it("reports full when every imported track is still there", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2 }),
      ],
    });
    expect(jobPresence(album, inLibrary([1, 2]))).toBe("full");
  });

  it("reports partial when some tracks were pulled out, none when all were", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2 }),
      ],
    });
    expect(jobPresence(album, inLibrary([1]))).toBe("partial");
    expect(jobPresence(album, inLibrary([]))).toBe("none");
  });

  it("ignores dropped duplicates — they never had an item of their own", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: 1 }),
        albumTrack({ index: 2, status: "done", itemId: 2, duplicateOf: 1 }),
      ],
    });
    // Without the exclusion the absent duplicate would read as "partial".
    expect(jobPresence(album, inLibrary([1]))).toBe("full");
  });

  it("counts tracks a cancel stopped between import and enrich", () => {
    const cancelled = job({
      kind: "album",
      status: "cancelled",
      tracks: [
        albumTrack({ index: 1, status: "imported", itemId: 1 }),
        albumTrack({ index: 2, status: "pending", itemId: null }),
      ],
    });
    // The item exists in beets even though enrich never ran on it.
    expect(jobPresence(cancelled, inLibrary([1]))).toBe("full");
    expect(jobPresence(cancelled, inLibrary([]))).toBe("none");
  });

  it("answers for a single through its report item", () => {
    const single = job({ status: "done", report: report({ itemId: 3 }) });
    expect(jobPresence(single, inLibrary([3]))).toBe("full");
    expect(jobPresence(single, inLibrary([]))).toBe("none");
  });
});

describe("jobDestination", () => {
  const inLibraryTrack = (over: Partial<LibraryTrack>) => track({ id: 1, album: "Cars", albumArtist: "VA", ...over });
  const lookup = (map: Record<number, LibraryTrack>) => (itemId: number | null) =>
    itemId == null ? undefined : map[itemId];

  it("points an album at the record its tracks landed on", () => {
    const album = job({ kind: "album", tracks: [albumTrack({ itemId: 7, status: "done" })] });
    expect(jobDestination(album, lookup({ 7: inLibraryTrack({ id: 7 }) }))).toBe("/library/albums/VA/Cars");
  });

  it("skips tracks whose item is gone and uses the first one still there", () => {
    const album = job({
      kind: "album",
      tracks: [albumTrack({ index: 1, itemId: 7 }), albumTrack({ index: 2, itemId: 8 })],
    });
    expect(jobDestination(album, lookup({ 8: inLibraryTrack({ id: 8 }) }))).toBe("/library/albums/VA/Cars");
  });

  it("sends a single to its album — there is no page for a lone track", () => {
    const single = job({ report: report({ itemId: 3 }) });
    expect(jobDestination(single, lookup({ 3: inLibraryTrack({ id: 3 }) }))).toBe("/library/albums/VA/Cars");
  });

  it("falls back to the track artist when the record names no album artist", () => {
    const single = job({ report: report({ itemId: 3 }) });
    const orphan = inLibraryTrack({ id: 3, albumArtist: "", artist: "Rascal Flatts" });
    expect(jobDestination(single, lookup({ 3: orphan }))).toBe("/library/albums/Rascal%20Flatts/Cars");
  });

  it("has nowhere to go while nothing is imported, or once the album tag is empty", () => {
    expect(jobDestination(job({ report: null }), lookup({}))).toBeNull();
    const single = job({ report: report({ itemId: 3 }) });
    expect(jobDestination(single, lookup({ 3: inLibraryTrack({ id: 3, album: "" }) }))).toBeNull();
  });
});
