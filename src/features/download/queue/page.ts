/** Rows per history page. Large enough that a normal session fits on one page,
 * small enough that the deck never renders hundreds of pipeline cells — each
 * card carries three animated markers, so the count is a rendering budget, not
 * a reading preference. The backend serves exactly this many per request. */
export const HISTORY_PAGE_SIZE = 25;

/** How many finished downloads the Downloads page keeps under the composer.
 * That page is about starting one; the archive is History's job. */
export const RECENT_JOBS = 5;
