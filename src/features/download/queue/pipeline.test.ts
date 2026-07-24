import { describe, expect, it } from "vitest";

import { canRetry, jobPipeline, trackPipeline } from "@/features/download/queue/pipeline";
import { albumTrack, job, report } from "@/features/download/testFixtures";

/** The pipeline is read as three states left to right; assert on those. */
const states = (steps: ReturnType<typeof jobPipeline>) => steps.map((s) => s.state);
const details = (steps: ReturnType<typeof jobPipeline>) => steps.map((s) => s.detail);

describe("jobPipeline", () => {
  it("leaves every step pending while the job is queued", () => {
    expect(states(jobPipeline(job({ status: "queued" }), null, null))).toEqual(["pending", "pending", "pending"]);
  });

  it("marks the running step active and the ones before it done", () => {
    expect(states(jobPipeline(job({ status: "importing" }), null, null))).toEqual(["done", "active", "pending"]);
  });

  it("reports a finished-but-unidentified single as empty, not done", () => {
    // The whole point of `empty`: the step ran, nothing answered. Showing a
    // check here would claim a match the Match column says is absent.
    const unmatched = job({ status: "done", report: report({ mbMatched: false }) });
    expect(states(jobPipeline(unmatched, null, null))[2]).toBe("empty");

    const matched = job({ status: "done", report: report({ mbMatched: true }) });
    expect(states(jobPipeline(matched, null, null))[2]).toBe("done");
  });

  it("treats a done single with no report at all as empty", () => {
    expect(states(jobPipeline(job({ status: "done", report: null }), null, null))[2]).toBe("empty");
  });

  it("leaves a finished album's enrich step alone — its tracks carry the reports", () => {
    const album = job({
      kind: "album",
      status: "done",
      report: null,
      tracks: [albumTrack({ status: "done" })],
    });
    expect(states(jobPipeline(album, null, null))).toEqual(["done", "done", "done"]);
  });

  it("reads a finished album that lost a track as partial, not failed", () => {
    // Regression: a 24-track playlist with one video pulled from YouTube used
    // to come back `failed`, so the row painted all three stages red and
    // claimed the import never ran — while 23 tracks had in fact landed.
    const album = job({
      kind: "album",
      status: "done",
      report: null,
      tracks: [albumTrack({ index: 1, status: "done" }), albumTrack({ index: 2, status: "failed" })],
    });
    expect(states(jobPipeline(album, null, null))).toEqual(["partial", "partial", "partial"]);
    // The tally stays on screen — that is what makes "partial" readable.
    expect(details(jobPipeline(album, null, null))).toEqual(["1/2", "1/2", "1/2"]);
  });

  it("offers a retry on a partial album and on an outright failure, never on a clean run", () => {
    const partial = job({
      kind: "album",
      status: "done",
      tracks: [albumTrack({ status: "done" }), albumTrack({ index: 2, status: "failed" })],
    });
    expect(canRetry(partial)).toBe(true);
    expect(canRetry(job({ status: "failed" }))).toBe(true);
    expect(canRetry(job({ kind: "album", status: "done", tracks: [albumTrack({ status: "done" })] }))).toBe(false);
  });

  it("fails the step the job died on and keeps the later ones pending", () => {
    const failed = job({ status: "failed", failedStep: "import" });
    expect(states(jobPipeline(failed, null, null))).toEqual(["done", "failed", "pending"]);
  });

  it("falls back to the first step when a failure names no step", () => {
    const failed = job({ status: "failed", failedStep: null });
    expect(states(jobPipeline(failed, null, null))).toEqual(["failed", "pending", "pending"]);
  });

  it("shows byte progress for a downloading single, and nothing without it", () => {
    const downloading = job({ status: "downloading" });
    expect(details(jobPipeline(downloading, 42.6, null))[0]).toBe("43 %");
    expect(details(jobPipeline(downloading, null, null))[0]).toBeNull();
  });

  it("counts fetched tracks for a downloading album", () => {
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
    // done + downloaded are on disk; downloading and pending are not.
    expect(details(jobPipeline(album, null, null))[0]).toBe("2/4");
  });

  it("counts enrich progress against the tracks that can be enriched", () => {
    const album = job({
      kind: "album",
      status: "enriching",
      tracks: [
        albumTrack({ index: 1, itemId: 10 }),
        albumTrack({ index: 2, itemId: 11 }),
        // Never imported, so it has no item and is not enrichable.
        albumTrack({ index: 3, itemId: null }),
      ],
    });
    expect(details(jobPipeline(album, null, 1))[2]).toBe("1/2");
    expect(details(jobPipeline(album, null, null))[2]).toBeNull();
  });
});

describe("trackPipeline", () => {
  it("walks the three stages as the track advances", () => {
    expect(trackPipeline(albumTrack({ status: "pending" }), false)).toEqual(["pending", "pending", "pending"]);
    expect(trackPipeline(albumTrack({ status: "downloading" }), false)).toEqual(["active", "pending", "pending"]);
    expect(trackPipeline(albumTrack({ status: "downloaded" }), false)).toEqual(["done", "pending", "pending"]);
  });

  it("keeps enrich active on an imported track until the album-wide pass reaches it", () => {
    expect(trackPipeline(albumTrack({ status: "imported" }), false)[2]).toBe("active");
    expect(trackPipeline(albumTrack({ status: "imported" }), true)[2]).toBe("done");
  });

  it("reports a finished but unmatched track as empty", () => {
    const done = albumTrack({ status: "done", report: report({ mbMatched: false }) });
    expect(trackPipeline(done, false)).toEqual(["done", "done", "empty"]);
  });

  it("counts a dropped duplicate as done — it was skipped on purpose", () => {
    const duplicate = albumTrack({ status: "done", report: null, duplicateOf: 7 });
    expect(trackPipeline(duplicate, false)[2]).toBe("done");
  });

  it("stops at the download step when the track failed", () => {
    expect(trackPipeline(albumTrack({ status: "failed" }), false)).toEqual(["failed", "pending", "pending"]);
  });
});
