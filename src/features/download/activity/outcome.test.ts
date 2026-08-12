import { describe, expect, it } from "vitest";

import { jobOutcome } from "@/features/download/activity/outcome";
import { albumTrack, job, report } from "@/features/download/testFixtures";

describe("jobOutcome", () => {
  it("says nothing about a job that is still working", () => {
    for (const status of ["queued", "downloading", "importing", "enriching"] as const) {
      expect(jobOutcome(job({ status }))).toBeNull();
    }
  });

  it("reports a stopped job as cancelled, whatever it had reached", () => {
    expect(jobOutcome(job({ status: "cancelled" }))).toEqual({ kind: "cancelled" });
  });

  it("reports a matched single with the source that answered", () => {
    const done = job({ status: "done", report: report({ mbMatched: true, source: "MusicBrainz" }) });
    expect(jobOutcome(done)).toEqual({ kind: "matched", source: "MusicBrainz" });
  });

  it("separates guessed tags from nothing at all", () => {
    const guessed = job({ status: "done", report: report({ mbMatched: false, provisional: true }) });
    const blank = job({ status: "done", report: report({ mbMatched: false, provisional: false }) });
    expect(jobOutcome(guessed)).toEqual({ kind: "guessed" });
    expect(jobOutcome(blank)).toEqual({ kind: "unmatched" });
  });

  it("counts an album's matches when only some answered", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", report: report({ mbMatched: true }) }),
        albumTrack({ index: 2, status: "done", report: report({ mbMatched: true }) }),
        albumTrack({ index: 3, status: "done", report: report({ mbMatched: false }) }),
      ],
    });
    expect(jobOutcome(album)).toEqual({ kind: "partialMatch", matched: 2, total: 3 });
  });

  it("does not let a dropped duplicate count as an unmatched track", () => {
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", report: report({ mbMatched: true }) }),
        albumTrack({ index: 2, status: "done", duplicateOf: 1, report: null }),
      ],
    });
    expect(jobOutcome(album)).toMatchObject({ kind: "matched" });
  });

  it("puts lost tracks ahead of any verdict on the ones that landed", () => {
    // Both are true of this batch; the missing videos are the bigger news.
    const album = job({
      kind: "album",
      status: "done",
      tracks: [
        albumTrack({ index: 1, status: "done", report: report({ mbMatched: false, provisional: true }) }),
        albumTrack({ index: 2, status: "failed" }),
      ],
    });
    expect(jobOutcome(album)).toEqual({ kind: "lostTracks", kept: 1, total: 2 });
  });

  it("calls a failed job failed whatever its tracks say", () => {
    expect(jobOutcome(job({ status: "failed", failedStep: "download" }))).toEqual({ kind: "failed" });
  });
});
