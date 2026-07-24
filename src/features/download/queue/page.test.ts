import { describe, expect, it } from "vitest";

import { pageOfJobs } from "@/features/download/queue/page";
import { job } from "@/features/download/testFixtures";

const jobs = Array.from({ length: 7 }, (_, index) => job({ id: `job-${index}` }));

describe("pageOfJobs", () => {
  it("slices the list in order, newest page first", () => {
    expect(pageOfJobs(jobs, 1, 3).jobs.map((j) => j.id)).toEqual(["job-0", "job-1", "job-2"]);
    expect(pageOfJobs(jobs, 3, 3).jobs.map((j) => j.id)).toEqual(["job-6"]);
  });

  it("counts pages from the remainder, never dropping the last partial one", () => {
    expect(pageOfJobs(jobs, 1, 3).pageCount).toBe(3);
    expect(pageOfJobs(jobs, 1, 7).pageCount).toBe(1);
  });

  it("clamps an out-of-range page instead of returning nothing", () => {
    // The case that matters: clearing the history while sitting on page 3.
    expect(pageOfJobs(jobs, 99, 3).page).toBe(3);
    expect(pageOfJobs(jobs, 0, 3).page).toBe(1);
    expect(pageOfJobs(jobs, 99, 3).jobs).toHaveLength(1);
  });

  it("reports one empty page for an empty history rather than zero pages", () => {
    const empty = pageOfJobs([], 1, 3);
    expect(empty).toEqual({ jobs: [], page: 1, pageCount: 1 });
  });
});
