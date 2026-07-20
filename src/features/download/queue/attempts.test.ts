import { describe, expect, it } from "vitest";

import { attemptOutcomes, jobAttempts, trackAttempts } from "@/features/download/queue/attempts";
import { albumTrack, job } from "@/features/download/testFixtures";

describe("attemptOutcomes", () => {
  it("draws one dot per allowed attempt, whatever happened", () => {
    expect(attemptOutcomes(0, "not-started")).toHaveLength(3);
    expect(attemptOutcomes(3, "failed")).toHaveLength(3);
  });

  it("leaves every dot untried before the first attempt", () => {
    expect(attemptOutcomes(0, "not-started")).toEqual(["untried", "untried", "untried"]);
    // A started count is meaningless while the phase says nothing ran.
    expect(attemptOutcomes(2, "not-started")).toEqual(["untried", "untried", "untried"]);
  });

  it("infers that every attempt before the current one failed", () => {
    // The retry loop only moves on after an error, so this is by construction.
    expect(attemptOutcomes(3, "running")).toEqual(["failure", "failure", "running"]);
    expect(attemptOutcomes(2, "succeeded")).toEqual(["failure", "success", "untried"]);
  });

  it("marks the last started attempt with the phase's outcome", () => {
    expect(attemptOutcomes(1, "running")).toEqual(["running", "untried", "untried"]);
    expect(attemptOutcomes(1, "succeeded")).toEqual(["success", "untried", "untried"]);
    expect(attemptOutcomes(1, "failed")).toEqual(["failure", "untried", "untried"]);
    expect(attemptOutcomes(3, "failed")).toEqual(["failure", "failure", "failure"]);
  });
});

describe("jobAttempts", () => {
  it("shows nothing started while the job is queued", () => {
    expect(jobAttempts(job({ status: "queued", downloadAttempts: 0 }))).toEqual(["untried", "untried", "untried"]);
  });

  it("counts the download as passed once the job moved on to a later step", () => {
    // Importing, enriching or done all mean the bytes landed.
    for (const status of ["importing", "enriching", "done"] as const) {
      expect(jobAttempts(job({ status, downloadAttempts: 2 }))[1]).toBe("success");
    }
  });

  it("only reads a failure as a download failure when that is the step that died", () => {
    const diedDownloading = job({ status: "failed", failedStep: "download", downloadAttempts: 3 });
    expect(jobAttempts(diedDownloading)).toEqual(["failure", "failure", "failure"]);

    // Died later: the download itself had succeeded.
    const diedImporting = job({ status: "failed", failedStep: "import", downloadAttempts: 1 });
    expect(jobAttempts(diedImporting)[0]).toBe("success");
  });
});

describe("trackAttempts", () => {
  it("maps a track's status onto the same three dots", () => {
    expect(trackAttempts(albumTrack({ status: "pending", downloadAttempts: 0 }))[0]).toBe("untried");
    expect(trackAttempts(albumTrack({ status: "downloading", downloadAttempts: 1 }))[0]).toBe("running");
    expect(trackAttempts(albumTrack({ status: "failed", downloadAttempts: 3 }))[2]).toBe("failure");
    // Downloaded, imported and done all mean the file is on disk.
    expect(trackAttempts(albumTrack({ status: "downloaded", downloadAttempts: 2 }))[1]).toBe("success");
  });
});
