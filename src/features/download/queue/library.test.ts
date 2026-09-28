import { describe, expect, it } from "vitest";

import { filedTracks, jobDestination, jobPresence, type PresenceLookup } from "@/features/download/queue/library";
import { albumTrack, job, report } from "@/features/download/testFixtures";
import type { LibraryTrack } from "@/features/library/api";
import { track } from "@/features/library/testFixtures";

const lookup = (present: Record<number, LibraryTrack>): PresenceLookup => ({
  has: (itemId) => itemId in present,
  trackFor: (itemId) => (itemId == null ? undefined : present[itemId]),
});

/** Ids present as anonymous tracks — enough for every test not about tags. */
const inLibrary = (ids: number[]) => lookup(Object.fromEntries(ids.map((id) => [id, track({ id })])));

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

  /** The row that used to show no label at all and read as unresolved
   * forever: every track dropped because the library already held it. */
  it("resolves an all-duplicates job against the tracks enrich kept", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", itemId: null, duplicateOf: 7 }),
        albumTrack({ index: 2, status: "done", itemId: null, duplicateOf: 8 }),
      ],
    });
    expect(jobPresence(album, inLibrary([7, 8]))).toBe("duplicate");
    // The kept originals were deleted since: claiming "already in the
    // library" would point at music that is no longer there.
    expect(jobPresence(album, inLibrary([]))).toBe("none");
  });

  /** beets recycles rowids; title or album must still match the report. */
  it("does not count a recycled id whose track no longer matches the report", () => {
    const single = job({
      status: "done",
      report: report({ itemId: 3, title: "Life is a Highway", album: "Cars" }),
    });
    const stranger = track({ id: 3, title: "Something Else", album: "Elsewhere" });
    expect(jobPresence(single, lookup({ 3: stranger }))).toBe("none");

    // One surviving anchor is enough: a destination change rewrites the
    // album, a retitle rewrites the title — never both for the same reason.
    const retitled = track({ id: 3, title: "Life is a Highway (Remaster)", album: "Cars" });
    expect(jobPresence(single, lookup({ 3: retitled }))).toBe("full");
  });

  it("trusts an id when the report predates the anchor tags", () => {
    const single = job({ status: "done", report: report({ itemId: 3 }) });
    const stranger = track({ id: 3, title: "Something Else", album: "Elsewhere" });
    expect(jobPresence(single, lookup({ 3: stranger }))).toBe("full");
  });
});

describe("jobDestination", () => {
  const inLibraryTrack = (over: Partial<LibraryTrack>) => track({ id: 1, album: "Cars", albumArtist: "VA", ...over });

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

  it("refuses to link a recycled id to a stranger's record", () => {
    const single = job({
      report: report({ itemId: 3, title: "Life is a Highway", album: "Cars" }),
    });
    const stranger = inLibraryTrack({ id: 3, title: "Something Else", album: "Elsewhere" });
    expect(jobDestination(single, lookup({ 3: stranger }))).toBeNull();
  });

  it("links an all-duplicates job to the record enrich kept", () => {
    const album = job({
      kind: "album",
      tracks: [albumTrack({ index: 1, itemId: null, duplicateOf: 7 })],
    });
    expect(jobDestination(album, lookup({ 7: inLibraryTrack({ id: 7 }) }))).toBe("/library/albums/VA/Cars");
  });
});

describe("filedTracks", () => {
  const filed = (index: number, itemId: number) =>
    albumTrack({
      index,
      itemId,
      status: "done",
      report: report({ itemId, title: `Song ${index}`, album: "New Model" }),
    });
  const ours = (id: number) => track({ id, title: `Song ${id}`, album: "New Model" });

  /** The history bug: an album deleted, its ids reused by the next import. The
   * card read the newcomer's tags and cover, and its delete targeted them. */
  it("drops ids beets handed to another record", () => {
    const album = job({ kind: "album", tracks: [filed(1, 1), filed(2, 2)] });
    const stranger = track({ id: 1, title: "Turbo Killer", album: "Trilogy" });
    expect(filedTracks(album, lookup({ 1: stranger, 2: ours(2) })).map((t) => t.id)).toEqual([2]);
  });

  it("keeps a track renamed or moved, as long as one of title or album still matches", () => {
    const album = job({ kind: "album", tracks: [filed(1, 1)] });
    const retitled = track({ id: 1, title: "Song 1 (Remastered)", album: "New Model" });
    expect(filedTracks(album, lookup({ 1: retitled }))).toHaveLength(1);
  });

  it("leaves out duplicates, which belong to the record enrich kept", () => {
    const album = job({ kind: "album", tracks: [filed(1, 1), albumTrack({ index: 2, itemId: null, duplicateOf: 9 })] });
    expect(filedTracks(album, lookup({ 1: ours(1), 9: ours(9) })).map((t) => t.id)).toEqual([1]);
  });

  it("reads a single through its report", () => {
    const single = job({ report: report({ itemId: 4, title: "Song 4", album: "New Model" }) });
    expect(filedTracks(single, lookup({ 4: ours(4) })).map((t) => t.id)).toEqual([4]);
    expect(filedTracks(single, lookup({ 4: track({ id: 4, title: "Other", album: "Other" }) }))).toEqual([]);
  });

  it("does not let a missing tag vouch for a recycled id", () => {
    const single = job({ report: report({ itemId: 4, title: "Song 4", album: null }) });
    expect(filedTracks(single, lookup({ 4: track({ id: 4, title: "Other", album: "Other" }) }))).toEqual([]);
  });
});
