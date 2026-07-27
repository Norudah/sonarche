import { describe, expect, it } from "vitest";

import { jobProgress } from "@/features/download/activity/progress";
import { albumTrack, job } from "@/features/download/testFixtures";

describe("jobProgress", () => {
  it("leaves every segment empty while the job waits its turn", () => {
    const progress = jobProgress(job({ status: "queued" }), null, null);
    expect(progress).toMatchObject({ phase: "queued", fills: [0, 0, 0], activeIndex: null });
  });

  it("fills a single's download segment from its byte percentage", () => {
    const progress = jobProgress(job({ status: "downloading" }), 43, null);
    expect(progress.fills[0]).toBeCloseTo(0.43);
    expect(progress.detail).toEqual({ kind: "percent", value: 43 });
  });

  it("fills an album's download segment from its track tally, not from bytes", () => {
    // The percentage belongs to the one file being fetched; on a playlist the
    // meaningful figure is how many of the set are on disk.
    const album = job({
      kind: "album",
      status: "downloading",
      tracks: [
        albumTrack({ index: 1, status: "done" }),
        albumTrack({ index: 2, status: "downloaded" }),
        albumTrack({ index: 3, status: "downloading" }),
        albumTrack({ index: 4, status: "pending" }),
      ],
    });
    const progress = jobProgress(album, 90, null);
    expect(progress.fills[0]).toBeCloseTo(0.5);
    expect(progress.detail).toEqual({ kind: "count", done: 2, total: 4 });
  });

  it("marks a single's import as working even though it has nothing to count", () => {
    const progress = jobProgress(job({ status: "importing" }), null, null);
    expect(progress).toMatchObject({ phase: "import", activeIndex: 1, detail: null });
    expect(progress.fills).toEqual([1, 0, 0]);
  });

  it("measures identification against the tracks that reached the library", () => {
    // The dead video never got an item id, so it cannot be identified and must
    // not hold the segment short of full.
    const album = job({
      kind: "album",
      status: "enriching",
      tracks: [
        albumTrack({ index: 1, status: "imported", itemId: 1 }),
        albumTrack({ index: 2, status: "imported", itemId: 2 }),
        albumTrack({ index: 3, status: "failed" }),
      ],
    });
    const progress = jobProgress(album, null, 2);
    expect(progress.fills[2]).toBe(1);
    expect(progress.detail).toEqual({ kind: "count", done: 2, total: 2 });
  });

  it("fills everything once the job is through", () => {
    expect(jobProgress(job({ status: "done" }), null, null).fills).toEqual([1, 1, 1]);
  });

  it("stops the rail at the stage that broke", () => {
    const progress = jobProgress(job({ status: "failed", failedStep: "import" }), null, null);
    expect(progress).toMatchObject({ phase: "failed", failedIndex: 1, activeIndex: null });
    expect(progress.fills).toEqual([1, 0, 0]);
  });

  it("blames the download when a failure names no stage", () => {
    const progress = jobProgress(job({ status: "failed", failedStep: null }), null, null);
    expect(progress.failedIndex).toBe(0);
    expect(progress.fills).toEqual([0, 0, 0]);
  });

  it("never overshoots a segment on a percentage past 100", () => {
    expect(jobProgress(job({ status: "downloading" }), 140, null).fills[0]).toBe(1);
  });
});
