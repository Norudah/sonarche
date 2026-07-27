import type { DownloadJob } from "@/features/download/api";

/** Rows per history page. Large enough that a normal session fits on one page,
 * small enough that the table never renders hundreds of pipeline cells — each
 * row carries three animated markers, so the count is a rendering budget, not
 * a reading preference. */
export const HISTORY_PAGE_SIZE = 25;

/** How many finished downloads the Downloads page keeps under the composer.
 * That page is about starting one; the archive is History's job. */
export const RECENT_JOBS = 5;

export interface JobPage {
  jobs: DownloadJob[];
  /** 1-based, clamped into range: a page that emptied out (history cleared
   * while sitting on page 4) resolves to the last page that still exists. */
  page: number;
  pageCount: number;
}

/**
 * One page of the history, newest first — the order `useJobs` already keeps.
 *
 * Clamping here rather than at the call site means the view never has to guess
 * whether its page number is still valid after the list changed under it.
 */
export function pageOfJobs(jobs: DownloadJob[], page: number, size = HISTORY_PAGE_SIZE): JobPage {
  const pageCount = Math.max(1, Math.ceil(jobs.length / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * size;
  return { jobs: jobs.slice(start, start + size), page: current, pageCount };
}
